/**
 * Live migration (2026-10-14): accounts and listings are anonymous from the create call on. Sharetribe
 * serves user and listing `metadata` and `publicData` to anonymous Marketplace API clients, so nothing
 * identifying may be written there, not even briefly before an anonymisation pass.
 */
import { describe, expect, it } from "vitest";
import { IMPORT_BATCH, PUBLIC_USER_METADATA_KEYS, buildAnonymousPayload, planImport } from "@/lib/imports/company-accounts";
import {
  PUBLIC_LISTING_METADATA_KEYS,
  buildAnonymousListingPayload,
  planListings,
  runListingImport,
  type ListingApi,
  type ListingLedgerEntry,
  type ListingPayload,
  type RemoteListing,
} from "@/lib/imports/operator-listings";
import { INQUIRY_ALIAS, OPERATOR_PLACEHOLDER, UNCLAIMED_NOTICE, anonymizeText } from "@/lib/operators/claim";
import { contactFromUser } from "@/lib/access/contacts";

const company = {
  externalId: "cw-1",
  importTier: "A_ready",
  emailPlaceholder: "acme-shows@<CLAIM_DOMAIN>",
  firstName: "Acme",
  lastName: "Shows",
  displayName: "Acme Shows",
  bio: "Acme Shows is a traveling carnival.",
  publicData: JSON.stringify({ companyName: "Acme Shows", hqCity: "Fairbury", hqState: "IL", statesServed: ["IL", "WI"], website: "https://acme.example" }),
  protectedData: JSON.stringify({ phoneNumber: "815-555-0101" }),
  privateData: JSON.stringify({ contactName: "Jane Roe", contactEmail: "jane@acme.example", hqStreet: "12 Fair Rd", legalEntityName: "Acme Amusement Co., Inc." }),
  metadata: JSON.stringify({ claimStatus: "unclaimed", importBatch: IMPORT_BATCH, companyId: "acme-shows", importSource: "cw_directory", researchStatus: "active" }),
};
const listing = (id: string, description = "Acme Shows brings the Berry Go Round. Run by Acme Amusement Co., Inc. since 1990.") => ({
  externalId: `acme-shows--${id}`,
  authorExternalId: "cw-1",
  title: "Berry Go Round",
  description,
  lat: 40.72781,
  lng: -88.52142,
  imageUrl: null,
  publicData: JSON.stringify({ rideCategory: "family", footprintSource: "unknown", homeState: "IL", serviceStates: ["IL"], location: { address: "Fairbury, IL", building: "" } }),
  privateData: JSON.stringify({ sourceRidePage: "https://acme.example/rides/1" }),
  metadata: JSON.stringify({ claimStatus: "unclaimed", importBatch: IMPORT_BATCH, companyId: "acme-shows" }),
});
const wb = { source: { file: "t.xlsx", sha256: "0".repeat(64) }, users: [company], companies: [{ companyId: "acme-shows", importTier: "A_ready" }], listings: [listing("a"), listing("b")] };

describe("anonymous company account payload", () => {
  const row = planImport(wb).eligible[0];
  const { create, metadata } = buildAnonymousPayload(row, "claims.example.org");
  const publicParts = JSON.stringify([create.displayName, create.firstName, create.lastName, create.bio, create.publicData, metadata]).toLowerCase();

  it("publishes only the operator placeholder and non-identifying fields", () => {
    expect(create.displayName).toBe(OPERATOR_PLACEHOLDER.displayName);
    expect(create.bio).toBe(OPERATOR_PLACEHOLDER.bio);
    expect(create.publicData).toEqual({ hqState: "IL", statesServed: ["IL", "WI"] });
    expect(Object.keys(metadata).sort()).toEqual([...PUBLIC_USER_METADATA_KEYS].sort());
    for (const s of ["acme", "fairbury", "jane", "815-555", "12 fair rd", "acme-shows", "cw_directory"]) expect(publicParts).not.toContain(s);
  });

  it("keeps identity, phone and import provenance operator-only, in the shape contacts.ts reads", () => {
    expect(create.protectedData).toEqual({});
    expect(create.privateData).toMatchObject({
      companyName: "Acme Shows",
      hqCity: "Fairbury",
      website: "https://acme.example",
      phone: "815-555-0101",
      contactEmail: "jane@acme.example",
      companyId: "acme-shows",
      importExternalId: "cw-1",
      originalProfile: { displayName: "Acme Shows", publicData: { companyName: "Acme Shows", hqCity: "Fairbury", website: "https://acme.example" } },
    });
    expect(create.email).toBe("acme-shows@claims.example.org");
  });
});

describe("reveal from an anonymous Live account", () => {
  it("returns the full contact record only from the operator-only fields", () => {
    const row = planImport(wb).eligible[0];
    const { create, metadata } = buildAnonymousPayload(row, "carnivalriderental.us");
    const user = { attributes: { email: create.email, profile: { publicData: create.publicData, protectedData: create.protectedData, privateData: create.privateData, metadata } } };
    expect(contactFromUser(user, {} as NodeJS.ProcessEnv)).toEqual({
      companyName: "Acme Shows",
      contactName: "Jane Roe",
      phone: "815-555-0101",
      email: "jane@acme.example",
      website: "https://acme.example",
      hqCity: "Fairbury",
      hqState: "IL",
      claimed: false,
    });
  });
});

describe("anonymous listing payload", () => {
  const plan = planListings(wb);
  const p = buildAnonymousListingPayload(plan.rows[0], plan.authors.get("cw-1")!);

  it("leads with the unclaimed notice and removes company names from the text", () => {
    expect(p.description!.startsWith(UNCLAIMED_NOTICE)).toBe(true);
    expect(p.description!.toLowerCase()).not.toContain("acme");
    expect(p.privateData.originalDescription).toContain("Acme Shows");
  });

  it("puts no company slug or import id in public metadata; hosted pages get the inquiry alias", () => {
    expect(Object.keys(p.metadata).every((k) => (PUBLIC_LISTING_METADATA_KEYS as readonly string[]).includes(k))).toBe(true);
    expect(JSON.stringify([p.title, p.publicData, p.metadata])).not.toMatch(/acme/i);
    expect(p.privateData).toMatchObject({ importExternalId: "acme-shows--a", companyId: "acme-shows" });
    expect(p.publicData).toMatchObject({ transactionProcessAlias: INQUIRY_ALIAS, unitType: "inquiry" });
  });

  it("does not leave a doubled article when a name followed 'the'", () => {
    expect(anonymizeText("to join the Acme Shows line-up", ["Acme Shows"])).toBe("to join the operator line-up");
  });
});

class FakeListings implements ListingApi {
  listings: (RemoteListing & { authorId: string })[] = [];
  async listByAuthor(authorId: string) {
    return this.listings.filter((l) => l.authorId === authorId);
  }
  async create(p: ListingPayload & { authorId: string }) {
    const id = `l-${this.listings.length + 1}`;
    this.listings.push({ id, state: p.state, metadata: p.metadata, privateData: p.privateData, authorId: p.authorId });
    return id;
  }
  async authorMetadata() {
    return { claimStatus: "unclaimed" };
  }
}

describe("anonymous listing import run", () => {
  it("deduplicates on the private import id, so reruns without the mapping create nothing", async () => {
    const plan = planListings(wb);
    const api = new FakeListings();
    const run = async (mapping = {}) => {
      const ledger: ListingLedgerEntry[] = [];
      await runListingImport(plan.rows, {
        api,
        mapping,
        accounts: { "cw-1": { userId: "u-1" } },
        saveMapping: () => {},
        now: () => "2026-10-14T00:00:00Z",
        runId: "t",
        build: (r) => buildAnonymousListingPayload(r, plan.authors.get(r.authorExternalId)!),
        onResult: (e) => void ledger.push(e),
      });
      return ledger.map((e) => e.outcome);
    };
    expect(await run()).toEqual(["created", "created"]);
    expect(api.listings.every((l) => !("importExternalId" in l.metadata) && !("companyId" in l.metadata))).toBe(true);
    expect(await run({})).toEqual(["exists", "exists"]);
    expect(api.listings).toHaveLength(2);
  });
});
