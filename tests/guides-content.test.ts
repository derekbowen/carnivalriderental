/**
 * Buyer guides follow the copy rules in lib/content/guides.ts, plus the founder rules of 2026-10-17:
 * no prices, no savings or competitor claims, ownership never asserted (only asked about), and
 * related links that resolve to real guides.
 */
import { describe, expect, it } from "vitest";
import { GUIDES, guideById } from "@/lib/content/guides";

const textOf = (g: (typeof GUIDES)[number]) =>
  [g.title, g.metaTitle, g.metaDescription, g.intro, g.checklistTitle, g.checklistIntro, ...g.sections.flatMap((s) => [s.heading, s.intro, s.note, ...s.items]), ...g.checklist.flatMap((c) => [c.group, ...c.questions]), ...g.faq.flatMap((f) => [f.q, f.a]), ...(g.related ?? []).map((r) => r.text)]
    .filter(Boolean)
    .join("\n");

describe("buyer guides", () => {
  it("have unique ids and related links that resolve", () => {
    expect(new Set(GUIDES.map((g) => g.id)).size).toBe(GUIDES.length);
    for (const g of GUIDES) for (const r of g.related ?? []) expect(guideById(r.id), `${g.id} → ${r.id}`).toBeTruthy();
  });

  it("make no price, savings or guarantee claims", () => {
    for (const g of GUIDES) {
      const t = textOf(g);
      expect(t, g.id).not.toMatch(/\$\s?\d/);
      expect(t, g.id).not.toMatch(/\bsav(e|es|ed|ing|ings)\b/i);
      expect(t, g.id).not.toMatch(/\bguarantee/i);
      expect(t, g.id).not.toMatch(/\b(cheapest|lowest price|best price)\b(?! headline)/i);
    }
  });

  it("never assert that listed operators own their rides", () => {
    for (const g of GUIDES) {
      const t = textOf(g);
      expect(t, g.id).not.toMatch(/\b(listed operators|our operators|operators listed on [^.]*) (own|owns)\b/i);
      expect(t, g.id).not.toMatch(/\bbelongs? to the (independent )?operator\b/i);
    }
  });

  it("the owner vs broker guide covers ownership, crews, insurance and inspections, and links back", () => {
    const g = guideById("ride-owner-vs-rental-broker")!;
    expect(g.sections.map((s) => s.id)).toEqual(["direct-rental", "brokered-rental", "ownership", "crew", "insurance", "inspections", "how-we-fit"]);
    for (const id of ["ownership", "crew", "insurance", "inspections"]) expect(g.sections.find((s) => s.id === id)!.items.every((i) => i.endsWith("?")), id).toBe(true);
    expect(g.related?.map((r) => r.id)).toEqual(["how-to-rent-carnival-rides"]);
    expect(guideById("how-to-rent-carnival-rides")!.related?.map((r) => r.id)).toEqual(["ride-owner-vs-rental-broker", "ferris-wheel-rental-cost"]);
    // The broker material lives in one guide only (no duplicate section in how-to-rent).
    expect(guideById("how-to-rent-carnival-rides")!.sections.some((s) => /broker/i.test(s.heading))).toBe(false);
    expect(textOf(g)).toContain("We don’t verify who owns each ride");
  });

  it("the Ferris wheel cost and wedding guides quote no prices and link to each other", () => {
    const cost = guideById("ferris-wheel-rental-cost")!;
    const wedding = guideById("ferris-wheel-wedding-rental")!;
    for (const g of [cost, wedding]) expect(textOf(g), g.id).not.toMatch(/\d/);
    expect(cost.related?.map((r) => r.id)).toContain("ferris-wheel-wedding-rental");
    expect(wedding.related?.map((r) => r.id)).toContain("ferris-wheel-rental-cost");
    for (const id of ["whats-included"]) expect(cost.sections.find((s) => s.id === id)!.items.every((i) => i.endsWith("?")), id).toBe(true);
    for (const id of ["venue", "timing", "operator-questions"]) expect(wedding.sections.find((s) => s.id === id)!.items.every((i) => i.endsWith("?")), id).toBe(true);
  });
});
