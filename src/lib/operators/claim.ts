/**
 * Operator accounts and claims (discovery-and-access model, founder decision 2026-10-06).
 *
 * Imported operator listings belong to placeholder company accounts (claim addresses on our domain).
 * Sharetribe does not allow changing a listing's author, so a claim transfers the ACCOUNT: after a
 * verified ownership check the account's email is changed to the operator's, the operator sets their
 * own password, and every listing (and its source mapping) stays exactly where it is. Nothing here
 * concerns payments: operators never connect Stripe and there is no booking eligibility.
 */

/**
 * Console: listing type operator-ride-rental → default-inquiry/release-1 (unitType inquiry, Free
 * messaging). Set on listings only so the hosted Sharetribe listing page renders; no transaction is
 * ever initiated by our product.
 */
export const INQUIRY_ALIAS = "default-inquiry/release-1";

/** First paragraph of every unclaimed listing's description (truthful: the operator has not joined). */
export const UNCLAIMED_NOTICE =
  "This operator has not joined Carnival Ride Rental yet. Contact details for this operator are available through Event Access on carnivalriderental.us. Messages sent from this page are held in the operator's account until they claim it.";

export function withNotice(description: string): string {
  const d = (description ?? "").trim();
  return d.startsWith(UNCLAIMED_NOTICE) ? d : `${UNCLAIMED_NOTICE}\n\n${d}`.trim();
}

export function withoutNotice(description: string): string {
  const d = (description ?? "").trim();
  return d.startsWith(UNCLAIMED_NOTICE) ? d.slice(UNCLAIMED_NOTICE.length).trim() : d;
}

/**
 * Ownership verification: an operator may claim a company account only with an email at the
 * company's own website domain (or a founder-recorded manual verification). A typed company name
 * proves nothing.
 */
export function emailMatchesCompanyDomain(email: string, website: string | null | undefined): boolean {
  const host = (() => {
    try {
      return new URL(/^https?:\/\//i.test(website ?? "") ? String(website) : `https://${website}`).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      return "";
    }
  })();
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  if (!host || !domain) return false;
  return domain === host || domain.endsWith(`.${host}`);
}

// ------------------------------------------------------------------------------ operator anonymity
// Founder decision 2026-10-05, kept under the access model (2026-10-06): nothing public on the hosted
// marketplace identifies the company, before OR after a claim (the identity is what Event Access
// sells). Originals are kept in privateData (owner + Integration API only) and are never restored to
// public fields; the claim script only changes ownership and metadata.

export const OPERATOR_PLACEHOLDER = {
  firstName: "Carnival",
  lastName: "Ride Rental",
  displayName: "Carnival Ride Rental operator",
  bio: "Carnival ride operator listed on Carnival Ride Rental. Contact details are available through Event Access on carnivalriderental.us.",
} as const;

/** User publicData keys that identify the company; moved to privateData while unclaimed. */
export const IDENTITY_PUBLIC_KEYS = ["companyName", "hqCity", "website", "otherOperations"] as const;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Remove the company's name(s), websites and emails from listing text. */
export function anonymizeText(text: string, names: string[]): string {
  let t = text ?? "";
  for (const n of [...new Set(names.map((x) => (x ?? "").trim()).filter((x) => x.length >= 3))].sort((a, b) => b.length - a.length)) {
    t = t.replace(new RegExp(`\\s*(?:—|-|,)?\\s*(?:operated|owned|run|provided) by ${escapeRe(n)}`, "gi"), "");
    t = t.replace(new RegExp(escapeRe(n), "gi"), "the operator");
  }
  t = t.replace(/\bhttps?:\/\/\S+/gi, "").replace(/\bwww\.\S+/gi, "").replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "");
  return t.replace(/[ \t]{2,}/g, " ").replace(/ +([.,;])/g, "$1").trim();
}
