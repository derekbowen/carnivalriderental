/**
 * Operator holds (founder decision 2026-10-18): a held operator keeps its public listings but is
 * never counted, offered or sold in Event Access matching.
 */
import { describe, expect, it, vi } from "vitest";
import operatorsFile from "@/lib/inventory/operators.json";

const held = vi.hoisted(() => new Set<string>());
vi.mock("@/lib/access/holds", async (orig) => {
  const real = await orig<typeof import("@/lib/access/holds")>();
  return { ...real, isHeldOperator: (id: string) => held.has(id) || real.isHeldOperator(id) };
});

const { fixtureSource } = await import("@/lib/access/contacts");
const { matchOperators, memoryContactCache } = await import("@/lib/access/matching");
const { OPERATOR_HOLDS, operatorKey } = await import("@/lib/access/holds");
const { cityBySlugs } = await import("@/lib/inventory");

describe("operator holds", () => {
  it("every held key is a real operator in the public snapshot (no typos, no names)", () => {
    const keys = new Set(Object.values((operatorsFile as { byListing: Record<string, string> }).byListing));
    for (const [k, reason] of Object.entries(OPERATOR_HOLDS)) {
      expect(keys.has(k), k).toBe(true);
      expect(k).toMatch(/^[0-9a-f]{12}$/);
      expect(reason.length).toBeGreaterThan(10);
    }
    expect(operatorKey("abc")).toMatch(/^[0-9a-f]{12}$/);
  });

  it("a held operator drops out of the match and its count; the others are unchanged", async () => {
    const columbus = cityBySlugs("ohio", "columbus")!;
    const input = { lat: columbus.lat, lng: columbus.lng, state: "OH", rideType: "ferris-wheel" };
    const before = await matchOperators(input, fixtureSource(), memoryContactCache());
    expect(before.contactableCount).toBeGreaterThan(1);
    const victim = before.operators[0].operatorId;
    held.add(victim);
    try {
      const after = await matchOperators(input, fixtureSource(), memoryContactCache());
      expect(after.operators.map((o) => o.operatorId)).not.toContain(victim);
      expect(after.contactableCount).toBe(before.contactableCount - 1);
    } finally {
      held.delete(victim);
    }
  });
});
