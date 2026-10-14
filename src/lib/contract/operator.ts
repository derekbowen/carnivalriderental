/**
 * Verification of a Sharetribe snapshot (npm run sharetribe:inspect) against the OPERATOR inventory
 * contract (contract/operator-listing-contract.json), the configuration the discovery-and-access model
 * runs on. The legacy managed-rental contract (contract/listing-contract.json, verifyConfiguration) is a
 * different, retired model: drift against it says nothing about the operator configuration.
 *
 * Every check is match / drift / unverified; only "all match" is a pass.
 */
import contract from "../../../contract/operator-listing-contract.json";
import type { CheckStatus, ConfigCheck, SharetribeSnapshot, VerificationReport } from "./index";

export const INQUIRY_PROCESS_ALIAS = "default-inquiry/release-1";

type Field = { key: string; scope?: string; schemaType?: string; enumOptions?: { option: string }[]; listingTypeConfig?: { limitToListingTypeIds?: boolean; listingTypeIds?: string[] } };
type ListingType = { id: string; unitType?: string; transactionProcess?: { alias?: string }; defaultListingFields?: Record<string, boolean> };

const SCHEMA: Record<string, string> = { enum: "enum", "multi-enum": "multi-enum", long: "long", text: "text" };
/** Lowercase codes of the 50 states + DC, as homeState/serviceStates store them. */
export const STATE_OPTIONS = ["al", "ak", "az", "ar", "ca", "co", "ct", "de", "dc", "fl", "ga", "hi", "id", "il", "in", "ia", "ks", "ky", "la", "me", "md", "ma", "mi", "mn", "ms", "mo", "mt", "ne", "nv", "nh", "nj", "nm", "ny", "nc", "nd", "oh", "ok", "or", "pa", "ri", "sc", "sd", "tn", "tx", "ut", "vt", "va", "wa", "wv", "wi", "wy"];

export function verifyOperatorConfiguration(snap: SharetribeSnapshot & { marketplaceApiClient?: string }): VerificationReport {
  const checks: ConfigCheck[] = [];
  const add = (id: string, status: CheckStatus, expected: unknown, actual: unknown, note?: string) => checks.push({ id, status, expected, actual, note });
  const eq = (id: string, expected: unknown, actual: unknown, note?: string) =>
    add(id, actual === undefined ? "unverified" : JSON.stringify(actual) === JSON.stringify(expected) ? "match" : "drift", expected, actual, note);
  const asset = (p: string) => (snap.assets[p]?.status === "ok" ? (snap.assets[p].data as Record<string, unknown>) : undefined);
  const id = contract.listingType.id;

  // Listing type: Free messaging (default-inquiry), no payout details, no booking.
  const types = asset("listings/listing-types.json")?.listingTypes as ListingType[] | undefined;
  if (!types) add(`listingType:${id}`, "unverified", "readable", snap.assets["listings/listing-types.json"]?.status);
  else {
    const lt = types.find((t) => t.id === id);
    if (!lt) add(`listingType:${id}`, "drift", "present", "missing");
    else {
      eq(`listingType:${id}.processAlias`, INQUIRY_PROCESS_ALIAS, lt.transactionProcess?.alias, "Free messaging; nothing transacts");
      eq(`listingType:${id}.unitType`, "inquiry", lt.unitType);
      eq(`listingType:${id}.payoutDetails`, false, lt.defaultListingFields?.payoutDetails, "operators never need payout details");
      eq(`listingType:${id}.availability`, false, lt.defaultListingFields?.availability, "no booking calendar");
    }
  }

  // Listing fields: every Console field of the contract, public, limited to the operator listing type.
  const fields = asset("listings/listing-fields.json")?.listingFields as Field[] | undefined;
  for (const f of contract.publicFields.filter((x) => (x as { consoleField?: boolean }).consoleField)) {
    if (!fields) {
      add(`field:${f.key}`, "unverified", "readable", snap.assets["listings/listing-fields.json"]?.status);
      continue;
    }
    const live = fields.find((x) => x.key === f.key);
    if (!live) {
      add(`field:${f.key}`, "drift", "present", "missing");
      continue;
    }
    eq(`field:${f.key}.scope`, "public", live.scope);
    eq(`field:${f.key}.schemaType`, SCHEMA[f.type], live.schemaType);
    eq(`field:${f.key}.listingTypes`, [id], live.listingTypeConfig?.limitToListingTypeIds ? live.listingTypeConfig.listingTypeIds : "all listing types");
    if (f.key === "rideClass") eq("field:rideClass.options", contract.rideClass.options.map((o) => o.option), live.enumOptions?.map((o) => o.option));
    if (f.key === "homeState" || f.key === "serviceStates") eq(`field:${f.key}.options`, [...STATE_OPTIONS].sort(), live.enumOptions?.map((o) => o.option).sort());
  }

  // Commission: we never take a cut of a rental.
  const commission = asset("transactions/commission.json");
  if (!commission) add("commission", "unverified", 0, snap.assets["transactions/commission.json"]?.status);
  else {
    eq("commission.provider", 0, (commission.providerCommission as { percentage?: number } | undefined)?.percentage);
    const customer = (commission.customerCommission as { percentage?: number } | undefined)?.percentage;
    if (customer !== undefined) eq("commission.customer", 0, customer);
  }

  // Anonymous catalog reads (private marketplaces return 403 and empty the public catalog).
  eq("marketplaceApi.anonymousRead", "verified", snap.marketplaceApiClient, "Make marketplace private must stay OFF");

  const counts: Record<CheckStatus, number> = { match: 0, drift: 0, unverified: 0 };
  for (const c of checks) counts[c.status]++;
  return {
    checks,
    counts,
    fullyVerified: counts.drift === 0 && counts.unverified === 0 && checks.length > 0,
    outOfCoverage: ["transaction process definition (Sharetribe CLI)", "Access control settings other than anonymous reads (Console)", "email templates", "user fields (none are configured)"],
  };
}
