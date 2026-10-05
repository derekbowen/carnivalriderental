import { describe, expect, it } from "vitest";
import { ipLocation, milesBetween, parseNear, toOperatorCard } from "@/lib/catalog/operator-search";
import { paths } from "@/lib/seo/routes";

const listing = (over: Record<string, unknown> = {}, pd: Record<string, unknown> = {}, md: Record<string, unknown> = {}) => ({
  id: "6ac255a8-e335-44cc-93e0-5e60a95b017c",
  type: "listing",
  attributes: {
    title: "Grand Carousel",
    state: "published",
    deleted: false,
    geolocation: { lat: 29.5, lng: -98.5 },
    publicData: { listingType: "operator-ride-rental", rideClass: "family", homeState: "tx", location: { address: "San Antonio, TX" }, ...pd },
    metadata: { claimStatus: "unclaimed", ...md },
    ...over,
  },
  relationships: { author: { data: { id: "u1" } }, images: { data: [{ id: "i1" }] } },
});
const included = [
  { id: "u1", type: "user", attributes: { profile: { displayName: "Alamo Attractions" } } },
  { id: "i1", type: "image", attributes: { variants: { "landscape-crop": { url: "https://sharetribe.imgix.net/x/i1" } } } },
];

describe("operator search cards", () => {
  it("maps public fields, distance and the rate-card estimate", () => {
    const c = toOperatorCard(listing(), included, { lat: 30.27, lng: -97.74 })!;
    expect(c).toMatchObject({ title: "Grand Carousel", rideClassLabel: "Family ride", base: "San Antonio, TX", company: "Alamo Attractions", bookable: false });
    expect(c.photo?.src).toBe("https://sharetribe.imgix.net/x/i1");
    expect(c.miles).toBeGreaterThan(60);
    expect(c.miles).toBeLessThan(90);
    expect(c.estimate).toMatch(/^Estimated from \$/);
  });

  it("is bookable only when the operator is marked Stripe-connected", () => {
    expect(toOperatorCard(listing({}, {}, { operatorConnected: true }), included, null)!.bookable).toBe(true);
    expect(toOperatorCard(listing({}, {}, { operatorConnected: "true" }), included, null)!.bookable).toBe(false);
  });

  it("never renders other listing types, unpublished or deleted listings", () => {
    expect(toOperatorCard(listing({}, { listingType: "managed-ride-rental" }), included, null)).toBeNull();
    expect(toOperatorCard(listing({ state: "pendingApproval" }), included, null)).toBeNull();
    expect(toOperatorCard(listing({ deleted: true }), included, null)).toBeNull();
  });

  it("unconfirmed ride sizes show no price", () => {
    expect(toOperatorCard(listing({ title: "Zipper" }, { rideClass: "major" }), included, null)!.estimate).toBeNull();
  });
});

describe("visitor location", () => {
  it("parses ?near and rejects junk", () => {
    expect(parseNear("30.27,-97.74")).toEqual({ lat: 30.27, lng: -97.74 });
    expect(parseNear("91,0")).toBeNull();
    expect(parseNear("x")).toBeNull();
  });

  it("uses Vercel IP headers for US visitors only", () => {
    const h = (m: Record<string, string>) => ({ get: (k: string) => m[k] ?? null });
    expect(ipLocation(h({ "x-vercel-ip-country": "US", "x-vercel-ip-latitude": "41.5", "x-vercel-ip-longitude": "-81.7", "x-vercel-ip-city": "Cleveland", "x-vercel-ip-country-region": "OH" }))).toMatchObject({ label: "Cleveland, OH" });
    expect(ipLocation(h({ "x-vercel-ip-country": "CA", "x-vercel-ip-latitude": "43.6", "x-vercel-ip-longitude": "-79.4" }))).toBeNull();
  });

  it("distance is sane", () => {
    expect(Math.round(milesBetween({ lat: 40.71, lng: -74.0 }, { lat: 34.05, lng: -118.24 }))).toBeGreaterThan(2400);
  });
});

describe("routes", () => {
  it("builds search and request-ride URLs", () => {
    expect(paths.search()).toBe("/s");
    expect(paths.search({ rideClass: "family", page: 2 })).toBe("/s?class=family&page=2");
    expect(paths.requestRide("6ac255a8-e335-44cc-93e0-5e60a95b017c")).toBe("/request?listing=6ac255a8-e335-44cc-93e0-5e60a95b017c");
    expect(() => paths.requestRide("../x")).toThrow();
  });
});
