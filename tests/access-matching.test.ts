import { describe, expect, it } from "vitest";
import { channelsOf, contactFromUser, fixtureSource, isContactable, normalizeWebsite, revealFields, type OperatorSource } from "@/lib/access/contacts";
import { geocode, matchOperators, memoryContactCache } from "@/lib/access/matching";
import { RIDES, ridesNear } from "@/lib/inventory";

const columbus = geocode("Columbus", "OH")!;

describe("geocoding", () => {
  it("resolves Census cities, then falls back to the state centre", () => {
    expect(columbus.resolved).toBe("city");
    expect(geocode("columbus", "oh")!.lat).toBeCloseTo(39.98, 1);
    expect(geocode("Nowhere Special", "OH")!.resolved).toBe("state");
    expect(geocode("x", "ZZ")).toBeNull();
  });
});

describe("operator matching", () => {
  const source = fixtureSource();

  it("sells access per operator: many listings from one company count once", async () => {
    const r = await matchOperators({ lat: columbus.lat, lng: columbus.lng, state: "OH", rideType: "ferris-wheel" }, source, memoryContactCache());
    const ids = r.operators.map((o) => o.operatorId);
    expect(new Set(ids).size).toBe(ids.length);
    const totalListings = r.operators.reduce((n, o) => n + o.listings.length, 0);
    expect(totalListings).toBeGreaterThan(r.operators.length); // grouping actually happened
    for (const o of r.operators) for (const l of o.listings) expect(l.rideType).toBe("ferris-wheel");
  });

  it("excludes uncontactable operators and anything outside the radius", async () => {
    const r = await matchOperators({ lat: columbus.lat, lng: columbus.lng, state: "OH", rideType: "ferris-wheel" }, source, memoryContactCache());
    for (const o of r.operators) {
      expect(o.contactable).toBe(true);
      expect(o.operatorId.endsWith("-6")).toBe(false); // bucket 6 has no channel
      expect(o.miles).toBeLessThanOrEqual(200);
    }
    const near = ridesNear(columbus.lat, columbus.lng).filter((x) => x.rideType === "ferris-wheel");
    expect(r.candidateListings).toBe(near.length);
  });

  it("filters by the requested ride type or class, and the context listing's type wins", async () => {
    const carousel = await matchOperators({ lat: columbus.lat, lng: columbus.lng, state: "OH", rideType: "carousel" }, source, memoryContactCache());
    for (const o of carousel.operators) for (const l of o.listings) expect(l.rideType).toBe("carousel");
    const kiddie = await matchOperators({ lat: columbus.lat, lng: columbus.lng, state: "OH", rideClass: "kiddie" }, source, memoryContactCache());
    for (const o of kiddie.operators) for (const l of o.listings) expect(l.rideClass).toBe("kiddie");
    const listing = RIDES.find((x) => x.rideType === "giant-slide")!;
    const ctx = await matchOperators({ lat: columbus.lat, lng: columbus.lng, state: "OH", listingId: listing.id, rideType: "carousel" }, source, memoryContactCache());
    expect(ctx.criteria.rideType).toBe("giant-slide");
  });

  it("ranks service geography, then distance; labels are anonymous", async () => {
    const r = await matchOperators({ lat: columbus.lat, lng: columbus.lng, state: "OH", rideType: "ferris-wheel" }, source, memoryContactCache());
    const serves = r.operators.map((o) => o.servesState);
    const firstNonServing = serves.indexOf(false);
    if (firstNonServing >= 0) expect(serves.slice(firstNonServing)).not.toContain(true);
    const inState = r.operators.filter((o) => o.servesState).map((o) => o.miles);
    expect([...inState].sort((a, b) => a - b)).toEqual(inState);
    expect(r.operators[0].label).toBe("Operator A");
    expect(JSON.stringify(r.operators)).not.toMatch(/Fixture Amusements|555 010|example\.test/);
  });

  it("uses the contactability cache instead of re-fetching", async () => {
    let calls = 0;
    const counting: OperatorSource = { ...source, contact: async (id) => { calls++; return source.contact(id); } };
    const cache = memoryContactCache();
    await matchOperators({ lat: columbus.lat, lng: columbus.lng, state: "OH", rideType: "ferris-wheel" }, counting, cache);
    const first = calls;
    await matchOperators({ lat: columbus.lat, lng: columbus.lng, state: "OH", rideType: "ferris-wheel" }, counting, cache);
    expect(calls).toBe(first);
  });
});

describe("contact record from a Sharetribe user", () => {
  const user = (over: Record<string, unknown> = {}, env: Record<string, string> = {}) => contactFromUser({ attributes: { email: "claim-abc@claims.carnivalriderental.us", profile: { publicData: {}, protectedData: { phoneNumber: "(614) 555-0100" }, privateData: { companyName: "Buckeye Amusements", contactName: "Sam", website: "buckeye.example", hqCity: "Columbus", ...(over.privateData as object) }, metadata: { claimStatus: "unclaimed", ...(over.metadata as object) } } } }, env as never);

  it("never exposes our placeholder claim address as the operator's email", () => {
    const c = user();
    expect(c.email).toBeNull();
    expect(c.phone).toBe("(614) 555-0100");
    expect(c.website).toBe("https://buckeye.example");
    expect(isContactable(channelsOf(c))).toBe(true);
  });

  it("uses contactEmail, or the account email only once claimed and not on our domain", () => {
    expect(user({ privateData: { contactEmail: "sam@buckeye.example" } }).email).toBe("sam@buckeye.example");
    expect(user({ metadata: { claimStatus: "claimed" } }).email).toBeNull(); // still our placeholder address
    const claimed = contactFromUser({ attributes: { email: "owner@buckeye.example", profile: { privateData: {}, metadata: { claimStatus: "claimed" } } } });
    expect(claimed.email).toBe("owner@buckeye.example");
    expect(claimed.claimed).toBe(true);
  });

  it("reveal is exactly the permitted fields", () => {
    const keys = Object.keys(revealFields(user())).sort();
    expect(keys).toEqual(["claimed", "companyName", "contactName", "email", "hqCity", "hqState", "phone", "website"]);
    expect(normalizeWebsite("not a url")).toBeNull();
    expect(normalizeWebsite("www.example.com/")).toBe("https://www.example.com");
  });
});
