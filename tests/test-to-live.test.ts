/**
 * Pre-cutover (Test marketplace) listing ids keep working after the 2026-10-14 Live cutover: they map
 * to the same listing in Live, so old /s/{id} links redirect and ?listing= keeps its ride and tier.
 */
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveCriteria } from "@/lib/access/pricing";
import { liveListingIdFor, RIDES } from "@/lib/inventory";

const file = JSON.parse(fs.readFileSync("src/lib/inventory/test-to-live.json", "utf8")) as { from: string; to: string; count: number; map: Record<string, string> };
const live = new Set(RIDES.map((r) => r.id));

describe("Test → Live listing ids", () => {
  it("maps public ids only, onto listings in the current Live snapshot", () => {
    expect(file).toMatchObject({ from: "CarnivalRental Test", to: "CarnivalRental" });
    expect(file.count).toBe(Object.keys(file.map).length);
    expect(file.count).toBeGreaterThan(0);
    for (const [t, l] of Object.entries(file.map)) {
      expect(t).toMatch(/^[0-9a-f-]{36}$/);
      expect(live.has(l), l).toBe(true);
      expect(live.has(t), t).toBe(false);
    }
    expect(Object.keys(file).sort()).toEqual(["count", "from", "generatedAt", "map", "to"]);
  });

  it("an old Ferris listing id resolves to its Live listing and stays the Ferris tier, whatever the client says", () => {
    const [oldId, liveId] = Object.entries(file.map).find(([, l]) => RIDES.find((r) => r.id === l)?.rideType === "ferris-wheel")!;
    expect(liveListingIdFor(oldId)).toBe(liveId);
    expect(resolveCriteria({ listingId: oldId, rideType: "carousel" })).toMatchObject({ listingId: liveId, tier: "ferris", basis: "listing" });
  });

  it("unknown ids are not mapped (they 404 instead of redirecting somewhere else)", () => {
    expect(liveListingIdFor("00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});
