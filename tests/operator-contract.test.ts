import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { verifyOperatorConfiguration } from "@/lib/contract/operator";

const live = JSON.parse(fs.readFileSync("contract/snapshots/carnivalrental-2026-10-14.json", "utf8"));
const clone = () => JSON.parse(JSON.stringify(live));

describe("operator contract verification", () => {
  it("passes the verified Live snapshot", () => {
    const r = verifyOperatorConfiguration(live);
    expect(r.counts).toMatchObject({ drift: 0, unverified: 0 });
    expect(r.fullyVerified).toBe(true);
  });

  it("flags a commission, a payout requirement and a non-inquiry process as drift", () => {
    const s = clone();
    s.assets["transactions/commission.json"].data.providerCommission.percentage = 10;
    const lt = s.assets["listings/listing-types.json"].data.listingTypes.find((t: { id: string }) => t.id === "operator-ride-rental");
    lt.defaultListingFields.payoutDetails = true;
    lt.transactionProcess.alias = "default-booking/release-1";
    const r = verifyOperatorConfiguration(s);
    expect(r.fullyVerified).toBe(false);
    expect(r.checks.filter((c) => c.status === "drift").map((c) => c.id).sort()).toEqual(["commission.provider", "listingType:operator-ride-rental.payoutDetails", "listingType:operator-ride-rental.processAlias"]);
  });

  it("never passes when anonymous reads were not verified or an asset is unreadable", () => {
    const s = clone();
    s.marketplaceApiClient = "error";
    s.assets["listings/listing-fields.json"] = { status: "error-403" };
    const r = verifyOperatorConfiguration(s);
    expect(r.fullyVerified).toBe(false);
    expect(r.counts.unverified).toBeGreaterThan(0);
  });
});
