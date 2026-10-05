/**
 * Verified claim of an imported (unclaimed) company account by its real operator.
 *
 * Sharetribe does not allow changing a listing's author, so the operator takes over the existing
 * placeholder ACCOUNT. Listings, images, source mappings and inquiries held in the account stay
 * where they are; nothing is duplicated.
 *
 *   npm run ops:claim -- --company <companyId> --email <operator email>                 # dry run: checks only
 *   npm run ops:claim -- --company <companyId> --email <operator email> --apply
 *   ... --manual-verification "<how the founder verified ownership>"   # when the email is not on the company's domain
 *
 * Steps (all supported Sharetribe APIs):
 *  1. Ownership check: the operator's email must be on the company's own website domain, or the
 *     founder records a manual verification. A typed company name proves nothing.
 *  2. Password reset for the placeholder's claim address (our domain, received by Resend inbound),
 *     read the reset email through the Resend receiving API, set a one-time password (discarded).
 *  3. Log in as the account and change its email to the operator's (Marketplace API
 *     current_user/change_email). Sharetribe emails the operator a verification link.
 *  4. Integration API: user metadata claimStatus=claimed (+ verification record); each listing gets
 *     metadata.claimStatus=claimed and the unclaimed notice removed from its description.
 *  5. The operator sets their own password with "Forgot password" on the marketplace, then manages
 *     their rides, inbox and payout details there. Rides are NOT bookable until `ops:bookable` passes.
 *
 * Test marketplace only unless --target live --founder-go. Never run for a company that asked to
 * be removed (imports/photos/takedowns.json).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import { AUTH, createClient, INTEG, MKT } from "./lib/sharetribe-client";
import { emailMatchesCompanyDomain, withoutNotice } from "../src/lib/operators/claim";

const argv = process.argv.slice(2);
const opt = (n: string) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const target = (opt("target") ?? "test") as "test" | "live";
const apply = argv.includes("--apply");
const companyId = opt("company");
const email = opt("email")?.trim().toLowerCase();
const manual = opt("manual-verification");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type User = { id: string; attributes: { email: string; emailVerified: boolean; profile: { displayName: string; publicData?: Record<string, unknown>; privateData?: Record<string, unknown>; metadata?: Record<string, unknown> } } };

async function anonToken() {
  const r = await fetch(AUTH, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.SHARETRIBE_CLIENT_ID!, grant_type: "client_credentials", scope: "public-read" }) });
  if (!r.ok) throw new Error(`anon auth HTTP ${r.status}`);
  return (await r.json()).access_token as string;
}

/** Newest received email to `to` with a subject matching `re`, after `since`, via Resend's receiving API. */
async function waitForEmail(to: string, re: RegExp, since: number): Promise<string> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set (claim mail is received by Resend inbound)");
  for (let i = 0; i < 24; i++) {
    await sleep(5000);
    const list = await (await fetch("https://api.resend.com/emails/receiving?limit=20", { headers: { Authorization: `Bearer ${key}` } })).json();
    const hit = (list.data ?? []).find((m: { to: string[]; subject: string; created_at: string }) => m.to?.map((x) => x.toLowerCase()).includes(to) && re.test(m.subject) && Date.parse(m.created_at) >= since - 5000);
    if (hit) {
      const full = await (await fetch(`https://api.resend.com/emails/receiving/${hit.id}`, { headers: { Authorization: `Bearer ${key}` } })).json();
      return String(full.text ?? full.html ?? "");
    }
  }
  throw new Error(`no "${re}" email for ${to} within 2 minutes`);
}

(async () => {
  if (target === "live" && !argv.includes("--founder-go")) throw new Error("Refusing Live without --founder-go");
  if (!companyId || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Usage: --company <companyId> --email <operator email> [--apply]");
  const dir = target === "test" ? "carnivalrental-test" : "carnivalrental-live";
  const accounts = JSON.parse(fs.readFileSync(`imports/company-accounts/${dir}/mapping.json`, "utf8")).accounts as Record<string, { userId: string; email: string; companyId: string }>;
  const acct = Object.values(accounts).find((a) => a.companyId === companyId);
  if (!acct) throw new Error(`No imported account for company ${companyId}`);
  const takedowns = fs.existsSync("imports/photos/takedowns.json") ? JSON.parse(fs.readFileSync("imports/photos/takedowns.json", "utf8")) : [];
  if (takedowns.some((t: { companyId: string }) => t.companyId === companyId)) throw new Error("Company asked to be removed; not claimable");

  const { call, headers } = createClient(target);
  const u = (await call<{ data: User }>("query", `${INTEG}/users/show?id=${acct.userId}`, { headers: await headers("integ") }, true)).data;
  const meta = u.attributes.profile.metadata ?? {};
  if (meta.claimStatus !== "unclaimed") throw new Error(`Account is not unclaimed (claimStatus=${String(meta.claimStatus)})`);
  if (u.attributes.email.toLowerCase() !== acct.email.toLowerCase()) throw new Error("Account email differs from the claim address on record; stop and investigate");
  const website = (u.attributes.profile.publicData?.website ?? u.attributes.profile.privateData?.website) as string | undefined;
  const domainOk = emailMatchesCompanyDomain(email, website);
  if (!domainOk && !manual) throw new Error(`Ownership not verified: ${email} is not on the company's website domain (${website ?? "no website on record"}). Verify another way and pass --manual-verification "<how>".`);
  const listings = (await call<{ data: { id: string; attributes: { description: string; metadata?: Record<string, unknown> } }[] }>("query", `${INTEG}/listings/query?authorId=${acct.userId}&perPage=100`, { headers: await headers("integ") }, true)).data;
  console.log(`Claim ${companyId} (${u.attributes.profile.displayName}, ${listings.length} listings) → ${email}. Verification: ${domainOk ? `email on ${website}` : `manual: ${manual}`}.${apply ? "" : " DRY RUN."}`);
  if (!apply) return;

  // 2. One-time password via reset to the claim address (received by us).
  const since = Date.now();
  const anon = await anonToken();
  const req = await fetch(`${MKT}/password_reset/request`, { method: "POST", headers: { Authorization: `Bearer ${anon}`, "Content-Type": "application/json" }, body: JSON.stringify({ email: acct.email }) });
  if (!req.ok) throw new Error(`password reset request HTTP ${req.status}`);
  const body = await waitForEmail(acct.email.toLowerCase(), /password reset/i, since);
  const token = decodeURIComponent((body.match(/[?&]t=([^&"\s]+)/) ?? [])[1] ?? "");
  if (!token) throw new Error("reset token not found in the email");
  const temp = crypto.randomBytes(24).toString("base64url");
  const reset = await fetch(`${MKT}/password_reset/reset`, { method: "POST", headers: { Authorization: `Bearer ${await anonToken()}`, "Content-Type": "application/json" }, body: JSON.stringify({ email: acct.email, passwordResetToken: token, newPassword: temp }) });
  if (!reset.ok) throw new Error(`password reset HTTP ${reset.status}`);

  // 3. Hand the account to the operator's email.
  const login = await fetch(AUTH, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.SHARETRIBE_CLIENT_ID!, grant_type: "password", scope: "user", username: acct.email, password: temp }) });
  if (!login.ok) throw new Error(`login HTTP ${login.status}`);
  const userToken = (await login.json()).access_token;
  const ch = await fetch(`${MKT}/current_user/change_email`, { method: "POST", headers: { Authorization: `Bearer ${userToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: temp, email }) });
  if (!ch.ok) throw new Error(`change_email HTTP ${ch.status}${ch.status === 409 ? " (email already used by another account)" : ""}`);

  // 4. Record the claim; listings stop showing the unclaimed notice.
  const at = new Date().toISOString();
  // The operator's own identity comes back (it was hidden while unclaimed; see ops:anonymize).
  const orig = u.attributes.profile.privateData?.originalProfile as { displayName?: string; firstName?: string; lastName?: string; bio?: string; publicData?: Record<string, unknown> } | undefined;
  await call("command", `${INTEG}/users/update_profile`, { method: "POST", headers: await headers("integ", true), body: JSON.stringify({
    id: acct.userId,
    ...(orig ? { displayName: orig.displayName, firstName: orig.firstName, lastName: orig.lastName, bio: orig.bio, publicData: orig.publicData ?? {} } : {}),
    metadata: { claimStatus: "claimed", claimedAt: at, claimVerification: domainOk ? `email-domain:${email.split("@")[1]}` : `manual:${String(manual).slice(0, 200)}` },
  }) }, true);
  for (const l of listings) {
    const full = await call<{ data: { attributes: { description: string; privateData?: Record<string, unknown> } } }>("query", `${INTEG}/listings/show?id=${l.id}`, { headers: await headers("integ") }, true);
    const restored = (full.data.attributes.privateData?.originalDescription as string | undefined) ?? withoutNotice(full.data.attributes.description);
    await call("command", `${INTEG}/listings/update`, { method: "POST", headers: await headers("integ", true), body: JSON.stringify({ id: l.id, description: restored, metadata: { claimStatus: "claimed", bookable: false } }) }, true);
  }
  fs.appendFileSync(`imports/company-accounts/${dir}/claims.jsonl`, `${JSON.stringify({ at, companyId, userId: acct.userId, listings: listings.length, verification: domainOk ? "email-domain" : "manual" })}\n`);
  console.log(`Claimed. Sharetribe sent a verification email to the operator. Next: operator uses "Forgot password" at the marketplace with ${email}, then sets payout details. ${listings.length} listings marked claimed, not bookable.`);
})().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
