import { describe, expect, it } from "vitest";
import { ipLocation, milesBetween, parseNear, rideFacts, toOperatorCard } from "@/lib/catalog/operator-search";
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
  it("maps public fields and distance; no approved rate means no price (Request a quote)", () => {
    const c = toOperatorCard(listing(), included, { lat: 30.27, lng: -97.74 })!;
    expect(c).toMatchObject({ title: "Grand Carousel", rideClassLabel: "Family ride", homeState: "TX" });
    expect("bookable" in c).toBe(false);
    expect(c.photo?.src).toBe("https://sharetribe.imgix.net/x/i1");
    expect(c.miles).toBeGreaterThan(60);
    expect(c.miles).toBeLessThan(90);
    expect(c.price).toBeNull();
  });

  it("never exposes the operator's company name or city (no bypassing the marketplace)", () => {
    const c = toOperatorCard(listing(), included, { lat: 30.27, lng: -97.74 })!;
    const text = JSON.stringify(c);
    expect(text).not.toMatch(/Alamo|San Antonio/);
    expect(c.photo?.alt).toBe("Grand Carousel");
  });

  it("detail facts: approved public fields only", () => {
    const f = rideFacts({ manufacturer: "Chance", minRiderHeightIn: 42, footprintLengthFt: 50, footprintWidthFt: 40, serviceStates: ["tx", "ok"], companyName: "Alamo", description: "x" });
    expect(f.map((x) => x.label)).toEqual(["Manufacturer", "Minimum rider height", "Space needed (operator's figure)", "States served"]);
    expect(JSON.stringify(f)).not.toMatch(/Alamo/);
  });


  it("never renders other listing types, unpublished or deleted listings", () => {
    expect(toOperatorCard(listing({}, { listingType: "managed-ride-rental" }), included, null)).toBeNull();
    expect(toOperatorCard(listing({ state: "pendingApproval" }), included, null)).toBeNull();
    expect(toOperatorCard(listing({ deleted: true }), included, null)).toBeNull();
  });

  it("shows a number only for a claimed listing with an operator-approved rate and unit", () => {
    const priced = (md: Record<string, unknown>, pd: Record<string, unknown> = { unitType: "day" }) =>
      toOperatorCard({ ...listing({}, pd, md), attributes: { ...listing({}, pd, md).attributes, price: { amount: 125000, currency: "USD" } } }, included, null)!.price;
    expect(priced({ claimStatus: "claimed", priceApproved: true })).toBe("$1,250 per day");
    expect(priced({ claimStatus: "claimed" })).toBeNull(); // no approval provenance
    expect(priced({ priceApproved: true })).toBeNull(); // unclaimed: price is ours, not the operator's
    expect(priced({ claimStatus: "claimed", priceApproved: true }, {})).toBeNull(); // no rental duration
  });

  it("unconfirmed ride sizes show no price", () => {
    expect(toOperatorCard(listing({ title: "Zipper" }, { rideClass: "major" }), included, null)!.price).toBeNull();
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
    expect(paths.connectListing("6ac255a8-e335-44cc-93e0-5e60a95b017c")).toBe("/connect?listing=6ac255a8-e335-44cc-93e0-5e60a95b017c");
    expect(paths.rideListing("6ac255a8-e335-44cc-93e0-5e60a95b017c")).toBe("/s/6ac255a8-e335-44cc-93e0-5e60a95b017c");
    expect(() => paths.connectListing("../x")).toThrow();
  });
});

describe("listingAuthorIds", () => {
  it("asks the public API to include the author (the relationship is absent otherwise) and keeps only ids", async () => {
    const { listingAuthorIds } = await import("@/lib/catalog/operator-search");
    const calls: string[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request) => {
      const u = String(url);
      calls.push(u);
      if (u.includes("/auth/token")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 });
      return new Response(JSON.stringify({ data: [{ id: "6ac25d13-69ba-4a14-9d1d-6c5ef96615c4", type: "listing", attributes: { title: "x" }, relationships: { author: { data: { id: "6ac24bee-b28b-4b87-be6c-28f463b32e77", type: "user" } } } }] }), { status: 200 });
    }) as typeof fetch;
    try {
      process.env.SHARETRIBE_CLIENT_ID ||= "test-client";
      const m = await listingAuthorIds(["6ac25d13-69ba-4a14-9d1d-6c5ef96615c4"]);
      expect(m.get("6ac25d13-69ba-4a14-9d1d-6c5ef96615c4")).toBe("6ac24bee-b28b-4b87-be6c-28f463b32e77");
      const q = calls.find((c) => c.includes("/listings/query"))!;
      expect(q).toContain("include=author");
      expect(q).toContain("fields.user=");
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
