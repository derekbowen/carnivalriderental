import { describe, expect, it } from "vitest";
import { CITIES, cityBySlugs, inventoryRoutes, linkedNearbyCities, linkedRideCities, PSEO_INVENTORY, RIDES, rideHome, ridesNear } from "@/lib/inventory";
import { directoryForState, directoryStates } from "@/lib/seo/directory";
import { stateBySlug } from "@/lib/taxonomy";

const key = (c: { state: string; slug: string }) => `${c.state}/${c.slug}`;

describe("internal links are bidirectional", () => {
  it("nearby-city links: every city listed links back", () => {
    for (const c of CITIES.filter((_, i) => i % 7 === 0)) {
      for (const n of linkedNearbyCities(c)) expect(linkedNearbyCities(n).map(key), `${key(n)} → ${key(c)}`).toContain(key(c));
    }
  });
  it("same-ride nearby links: every page listed links back, and only to pages that exist", () => {
    for (const t of ["ferris-wheel", "carousel", "kiddie-train"]) {
      const pages = CITIES.filter((c) => ridesNear(c.lat, c.lng).filter((r) => r.rideType === t).length >= PSEO_INVENTORY.rideCityMinRides);
      for (const c of pages.filter((_, i) => i % 5 === 0)) {
        for (const n of linkedRideCities(c, t)) {
          expect(ridesNear(n.lat, n.lng).filter((r) => r.rideType === t).length).toBeGreaterThanOrEqual(PSEO_INVENTORY.rideCityMinRides);
          expect(linkedRideCities(n, t).map(key)).toContain(key(c));
        }
      }
    }
  });
  it("lists stay small (at most 30)", () => {
    expect(Math.max(...CITIES.map((c) => linkedNearbyCities(c).length))).toBeLessThanOrEqual(30);
  });
});

describe("site directory", () => {
  const existing = new Set(inventoryRoutes().map((r) => r.path));
  it("covers every state and links only real, supply-sufficient pages", () => {
    expect(directoryStates()).toHaveLength(51);
    for (const s of ["ohio", "california", "alaska"]) {
      const { cities } = directoryForState(stateBySlug(s)!);
      for (const c of cities) {
        expect(existing.has(c.href), c.href).toBe(true);
        for (const t of c.rideTypes) expect(existing.has(t.href), t.href).toBe(true);
      }
    }
  });
  it("lists every ride listing exactly once across all states", () => {
    const all = directoryStates().flatMap((s) => directoryForState(s.state).rides.map((r) => r.href));
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBe(RIDES.filter((r) => r.homeState).length);
  });
});

describe("listing placement (breadcrumbs and back links)", () => {
  it("places a ride in its home state, at a city page that exists", () => {
    const existing = new Set(inventoryRoutes().map((r) => r.path));
    for (const r of RIDES.filter((_, i) => i % 97 === 0)) {
      const h = rideHome(r);
      if (!h) continue;
      expect(h.state.code).toBe(r.homeState);
      if (h.city) expect(existing.has(`/${h.city.stateSlug}/${h.city.slug}`)).toBe(true);
      if (h.rideCityPath) expect(existing.has(h.rideCityPath)).toBe(true);
    }
    expect(cityBySlugs("ohio", "columbus")).not.toBeNull();
  });
});
