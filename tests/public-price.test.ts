import { describe, expect, it } from "vitest";
import { listingPriceLabel, REQUEST_A_QUOTE } from "@/lib/pricing/public-price";

describe("public price rule", () => {
  const ok = { claimed: true, priceApproved: true, unitType: "day", price: { amount: 90000, currency: "USD" } };
  it("formats an approved operator rate with its duration", () => {
    expect(listingPriceLabel(ok)).toBe("$900 per day");
    expect(listingPriceLabel({ ...ok, unitType: "hour" })).toBe("$900 per hour");
  });
  it("never shows $0, non-USD, unapproved, unclaimed or unit-less prices", () => {
    expect(listingPriceLabel({ ...ok, price: { amount: 0, currency: "USD" } })).toBeNull();
    expect(listingPriceLabel({ ...ok, price: { amount: 90000, currency: "EUR" } })).toBeNull();
    expect(listingPriceLabel({ ...ok, priceApproved: "true" })).toBeNull();
    expect(listingPriceLabel({ ...ok, claimed: false })).toBeNull();
    expect(listingPriceLabel({ ...ok, unitType: undefined })).toBeNull();
    expect(listingPriceLabel({ ...ok, price: null })).toBeNull();
    expect(REQUEST_A_QUOTE).toBe("Priced by the operator");
  });
});
