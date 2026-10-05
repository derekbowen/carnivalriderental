import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { CITIES, cityBySlugs, cityStats, inventoryCityGate, inventoryRideCityGate, PSEO_INVENTORY, RIDES, ridesNear, rideTypeFor, toCard } from "@/lib/inventory";

describe("inventory snapshot", () => {
  it("holds no operator identity (no company, city, website, email or description)", () => {
    const raw = fs.readFileSync("src/lib/inventory/rides.json", "utf8");
    const keys = new Set(RIDES.flatMap((r) => Object.keys(r)));
    for (const k of ["companyName", "companyId", "companyCity", "description", "website", "email", "author"]) expect(keys.has(k)).toBe(false);
    expect(raw).not.toMatch(/https?:\/\/(?!sharetribe\.imgix\.net)/);
    expect(raw).not.toMatch(/@[\w-]+\.(com|net|org|us)/);
  });
  it("cities are real Census places with coordinates", () => {
    expect(CITIES.length).toBeGreaterThan(1500);
    const austin = cityBySlugs("texas", "austin")!;
    expect(austin).toMatchObject({ name: "Austin", stateAbbr: "TX" });
    expect(Math.round(austin.lat)).toBe(30);
    expect(cityBySlugs("missouri", "kansas-city")?.name).toBe("Kansas City");
    expect(cityBySlugs("texas", "nowhere")).toBeNull();
  });
});

describe("pages are computed from real supply", () => {
  const c = cityBySlugs("ohio", "columbus")!;
  it("nearest first, within the radius", () => {
    const near = ridesNear(c.lat, c.lng);
    expect(near.length).toBeGreaterThan(0);
    expect(near.every((r, i) => r.miles <= PSEO_INVENTORY.radiusMiles && (i === 0 || r.miles >= near[i - 1].miles))).toBe(true);
    expect(cityStats(c).total).toBe(near.length);
  });
  it("cards carry no identity and never a $0 price", () => {
    const card = toCard(ridesNear(c.lat, c.lng)[0]);
    expect(Object.keys(card)).not.toContain("company");
    expect(card.price).toBeNull(); // snapshot holds no operator-approved rate
  });
  it("nothing is indexable until the founder approves the copy and indexing", () => {
    expect(inventoryCityGate(c).indexable).toBe(false);
    expect(inventoryCityGate(c).reasons.join(" ")).toMatch(/not founder-approved/);
    expect(inventoryRideCityGate(c, "ferris-wheel").indexable).toBe(false);
    expect(rideTypeFor("ferris-wheel")?.name).toBe("Ferris wheel");
  });
});
