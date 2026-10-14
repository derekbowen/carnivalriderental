/**
 * Operator identity and contact: the locked layer. Read server-side only, from Sharetribe
 * (Integration API user privateData/protectedData), and only inside an entitlement check
 * (service.ts → unlockOperator) or to compute contactability flags (never values) before payment.
 *
 * Listing → operator mapping comes from the public Marketplace API (author ids; authors are
 * anonymised there). A fixture source stands in for both when ACCESS_OPERATOR_SOURCE=fixture
 * (local development and e2e only; refused outside APP_ENV=development).
 */
import crypto from "node:crypto";
import { listingAuthorIds } from "../catalog/operator-search";
import { appEnv } from "../config";
import { integrationGet } from "../integrations/sharetribe";
import { RIDES } from "../inventory";

export interface OperatorContact {
  companyName: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  hqCity: string | null;
  hqState: string | null;
  claimed: boolean;
}
export interface ContactChannels {
  hasPhone: boolean;
  hasEmail: boolean;
  hasWebsite: boolean;
  claimed: boolean;
}
export interface OperatorSource {
  kind: "sharetribe" | "fixture";
  /** Listing id → Sharetribe operator (author) id. Missing ids are left out. */
  authorsFor(listingIds: string[]): Promise<Map<string, string>>;
  contact(operatorId: string): Promise<OperatorContact | null>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Addresses on our own domains are placeholders we created, never an operator's contact. */
function isOurAddress(email: string | null, env = process.env): boolean {
  if (!email) return false;
  const d = email.toLowerCase().split("@")[1] ?? "";
  const ours = ["carnivalriderental.us", (env.IMPORT_CLAIM_EMAIL_DOMAIN || "").toLowerCase()].filter(Boolean);
  return ours.some((o) => d === o || d.endsWith(`.${o}`));
}

export function normalizeWebsite(w: string | null): string | null {
  if (!w) return null;
  const s = w.trim();
  if (!s || /\s/.test(s)) return null;
  const url = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(url);
    if (!/\./.test(u.hostname)) return null;
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function normalizePhone(p: string | null): string | null {
  if (!p) return null;
  const digits = p.replace(/[^\d+]/g, "");
  return digits.replace(/\D/g, "").length >= 10 ? p.trim() : null;
}

export const channelsOf = (c: OperatorContact): ContactChannels => ({ hasPhone: !!c.phone, hasEmail: !!c.email, hasWebsite: !!c.website, claimed: c.claimed });
export const isContactable = (ch: ContactChannels) => ch.hasPhone || ch.hasEmail || ch.hasWebsite;

/** Integration API user → contact record. Only these fields ever leave this module. */
export function contactFromUser(u: { attributes: { email?: string; profile?: { publicData?: Record<string, unknown>; protectedData?: Record<string, unknown>; privateData?: Record<string, unknown>; metadata?: Record<string, unknown> } } }, env = process.env): OperatorContact {
  const p = u.attributes.profile ?? {};
  const priv = p.privateData ?? {};
  const orig = (priv.originalProfile ?? {}) as { displayName?: unknown; publicData?: Record<string, unknown> };
  const claimed = p.metadata?.claimStatus === "claimed";
  const contactEmail = str(priv.contactEmail);
  const accountEmail = claimed && !isOurAddress(str(u.attributes.email), env) ? str(u.attributes.email) : null;
  const email = [contactEmail, accountEmail].find((e) => e && EMAIL_RE.test(e) && !isOurAddress(e, env)) ?? null;
  return {
    companyName: str(priv.companyName) ?? str(priv.legalEntityName) ?? str(orig.displayName) ?? str(p.publicData?.companyName),
    contactName: str(priv.contactName),
    phone: normalizePhone(str(p.protectedData?.phoneNumber) ?? str(priv.phone)),
    email,
    website: normalizeWebsite(str(priv.website) ?? str(orig.publicData?.website) ?? str(p.publicData?.website)),
    hqCity: str(priv.hqCity) ?? str(p.publicData?.hqCity),
    hqState: (str(priv.hqState) ?? str(p.publicData?.hqState))?.toUpperCase() ?? null,
    claimed,
  };
}

function sharetribeSource(): OperatorSource {
  return {
    kind: "sharetribe",
    authorsFor: listingAuthorIds,
    async contact(operatorId) {
      if (!/^[0-9a-f-]{36}$/.test(operatorId)) return null;
      try {
        const r = await integrationGet<{ data: Parameters<typeof contactFromUser>[0] }>("/users/show", { id: operatorId });
        return contactFromUser(r.data);
      } catch {
        return null;
      }
    },
  };
}

/**
 * Fixture: deterministic fictional operators (up to seven per home state, derived from the listing
 * id), so local and e2e runs see several operators with mixed contact channels and no real company
 * anywhere. Bucket 6 has no contact channel at all.
 */
export function fixtureSource(): OperatorSource {
  const bucket = (listingId: string) => parseInt(crypto.createHash("sha1").update(listingId).digest("hex").slice(0, 2), 16) % 7;
  const byId = new Map(RIDES.map((r) => [r.id, r]));
  const state = (listingId: string) => byId.get(listingId)?.homeState?.toLowerCase() ?? "zz";
  const contacts: Record<number, Partial<OperatorContact>> = {
    0: { phone: "+1 555 010 0000", email: "ops0@example.test", website: "https://fixture-zero.example.test", claimed: true },
    1: { phone: "+1 555 010 0001", email: null, website: "https://fixture-one.example.test" },
    2: { phone: null, email: "ops2@example.test", website: null },
    3: { phone: "+1 555 010 0003", email: null, website: null },
    4: { phone: null, email: null, website: "https://fixture-four.example.test" },
    5: { phone: "+1 555 010 0005", email: "ops5@example.test", website: null },
    6: { phone: null, email: null, website: null }, // uncontactable
  };
  return {
    kind: "fixture",
    async authorsFor(ids) {
      return new Map(ids.filter((id) => byId.has(id) || /^[0-9a-f-]{36}$/.test(id)).map((id) => [id, `op-fixture-${state(id)}-${bucket(id)}`]));
    },
    async contact(operatorId) {
      const m = /^op-fixture-([a-z]{2})-(\d)$/.exec(operatorId);
      if (!m) return null;
      const b = Number(m[2]);
      return { companyName: `Fixture Amusements ${m[1].toUpperCase()}${b}`, contactName: b === 0 ? "Pat Fixture" : null, hqCity: "Fixtureville", hqState: null, claimed: false, phone: null, email: null, website: null, ...contacts[b] } as OperatorContact;
    },
  };
}

export function operatorSource(env: Record<string, string | undefined> = process.env): OperatorSource {
  if (env.ACCESS_OPERATOR_SOURCE === "fixture") {
    if ((env.APP_ENV || "development") !== "development") throw new Error("ACCESS_OPERATOR_SOURCE=fixture is only allowed in development");
    return fixtureSource();
  }
  return sharetribeSource();
}

/** The permitted reveal: the whole contact record is the product, nothing else is added. */
export function revealFields(c: OperatorContact): Omit<OperatorContact, "claimed"> & { claimed: boolean } {
  return { companyName: c.companyName, contactName: c.contactName, phone: c.phone, email: c.email, website: c.website, hqCity: c.hqCity, hqState: c.hqState, claimed: c.claimed };
}
