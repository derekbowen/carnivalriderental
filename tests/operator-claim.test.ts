import { describe, expect, it } from "vitest";
import { anonymizeText, bookingBlockers, emailMatchesCompanyDomain, UNCLAIMED_NOTICE, withNotice, withoutNotice } from "@/lib/operators/claim";

describe("ownership verification", () => {
  it("accepts only emails on the company's own website domain", () => {
    expect(emailMatchesCompanyDomain("owner@alamoattractionsinc.com", "https://www.alamoattractionsinc.com/")).toBe(true);
    expect(emailMatchesCompanyDomain("Owner@Mail.AlamoAttractionsInc.com", "alamoattractionsinc.com")).toBe(true);
    expect(emailMatchesCompanyDomain("owner@gmail.com", "https://www.alamoattractionsinc.com/")).toBe(false);
    expect(emailMatchesCompanyDomain("owner@notalamoattractionsinc.com", "alamoattractionsinc.com")).toBe(false);
    expect(emailMatchesCompanyDomain("owner@x.com", null)).toBe(false);
  });
});

describe("unclaimed notice", () => {
  it("is added once and removed cleanly", () => {
    const d = withNotice(withNotice("Grand Carousel."));
    expect(d.split(UNCLAIMED_NOTICE).length).toBe(2);
    expect(withoutNotice(d)).toBe("Grand Carousel.");
  });
});

describe("booking eligibility", () => {
  const ready = { claimStatus: "claimed", stripeConnected: true, stripePayoutsEnabled: true, rideApproved: true, priceAmount: 500000, commissionDecided: true };
  it("all conditions met → bookable", () => expect(bookingBlockers(ready)).toEqual([]));
  it("connecting Stripe alone is never enough", () => {
    expect(bookingBlockers({ ...ready, claimStatus: "unclaimed", rideApproved: undefined, priceAmount: null, commissionDecided: false })).toHaveLength(4);
  });
  it("each missing condition blocks", () => {
    expect(bookingBlockers({ ...ready, stripePayoutsEnabled: false })).toEqual(["Stripe onboarding incomplete"]);
    expect(bookingBlockers({ ...ready, priceAmount: 0 })).toEqual(["no operator-approved price"]);
    expect(bookingBlockers({ ...ready, commissionDecided: false })).toEqual(["commission not decided (real-money payments gated)"]);
  });
});

describe("operator anonymity", () => {
  it("removes company names, websites and emails from listing text", () => {
    const names = ["Alamo Attractions Inc", "Alamo Attractions"];
    expect(anonymizeText("Grand Carousel — family ride operated by Alamo Attractions. Space needed: 20 ft.", names)).toBe("Grand Carousel — family ride. Space needed: 20 ft.");
    const t = anonymizeText("ALAMO ATTRACTIONS brings fun! Book at https://www.alamoattractionsinc.com/ or info@alamo.com.", names);
    expect(t).not.toMatch(/alamo/i);
    expect(t).toMatch(/^the operator brings fun!/);
  });
});
