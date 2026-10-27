import { afterEach, describe, expect, it } from "vitest";
import type { CatalogRecord } from "@/lib/catalog/normalize";
import type { CatalogSnapshot } from "@/lib/catalog/source";
import { occasionGate, occasionStateGate, PSEO_THRESHOLDS, pseoRoutes, stateGate, supplyFor } from "@/lib/seo/pseo";
import { checkSlugNamespaces, RESERVED_TOP_LEVEL } from "@/lib/seo/namespaces";
import { paths } from "@/lib/seo/routes";
import { cardFromCatalog } from "@/lib/catalog/card";
import { breadcrumbs, graph, itemList, rentalService, serializeJsonLd } from "@/lib/seo/structured-data";
import { GUIDES } from "@/lib/content/guides";
import occasionsJson from "@/lib/taxonomy/occasions.json";
import rideTypesJson from "@/lib/taxonomy/ride-types.json";
import { checkTaxonomies, occasionById, OCCASIONS, RIDE_TYPES, schemas, stateBySlug, US_STATES, type Occasion } from "@/lib/taxonomy";

const rec = (over: Partial<CatalogRecord> = {}): CatalogRecord => ({
  offerKey: `ofr-${Math.random().toString(36).slice(2, 8)}`,
  listingId: "x",
  slug: "ferris-wheel-rental",
  title: "Ferris wheel rental",
  description: "",
  categoryId: "ferris-wheels",
  requestableStates: ["tx"],
  eventTypes: null,
  pricing: { mode: "quote-required" },
  isTestSample: false,
  withheld: [],
  ...over,
});
const snap = (records: CatalogRecord[], source: CatalogSnapshot["source"] = "sharetribe-marketplace-api"): CatalogSnapshot => ({ records, rejected: [], fetchedAt: "", source });
const live = (n: number, over: Partial<CatalogRecord> = {}) => Array.from({ length: n }, () => rec(over));
const approved = (id: string): Occasion => ({ ...occasionById(id)!, reviewStatus: "approved" });
const TX = stateBySlug("texas")!;

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});
const indexingOn = () => {
  process.env.APP_ENV = "production";
  process.env.PUBLIC_INDEXING = "true";
};

describe("taxonomies", () => {
  it("has 50 states + DC with contract codes and unique slugs", () => {
    expect(US_STATES).toHaveLength(51);
    expect(stateBySlug("district-of-columbia")?.code).toBe("dc");
    expect(new Set(US_STATES.map((s) => s.slug)).size).toBe(51);
  });

  it("has 50–75 occasions and the top 50 ride types, all draft until reviewed", () => {
    expect(OCCASIONS.length).toBeGreaterThanOrEqual(50);
    expect(OCCASIONS.length).toBeLessThanOrEqual(75);
    expect(RIDE_TYPES).toHaveLength(50);
    expect(RIDE_TYPES.map((r) => r.priority)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
    expect([...OCCASIONS, ...RIDE_TYPES].every((x) => x.reviewStatus === "draft")).toBe(true);
    for (const id of ["birthday-parties", "bar-mitzvahs", "bat-mitzvahs", "quinceaneras", "40th-birthday-parties", "school-carnivals", "company-picnics"]) {
      expect(occasionById(id), id).toBeDefined();
    }
  });

  it("rejects unknown eventTypes, unknown categories and unknown keys", () => {
    const base = OCCASIONS[0];
    expect(schemas.occasion.safeParse({ ...base, eventType: "wedding" }).success).toBe(false);
    expect(schemas.occasion.safeParse({ ...base, suggestedCategories: ["bounce-houses"] }).success).toBe(false);
    expect(schemas.occasion.safeParse({ ...base, capacity: 40 }).success).toBe(false);
    expect(schemas.rideType.safeParse({ ...RIDE_TYPES[0], heightFt: 60 }).success).toBe(false);
  });

  it("catches duplicate ids and broken related links", () => {
    const o = schemas.occasionsFile.parse(occasionsJson);
    const r = schemas.rideTypesFile.parse(rideTypesJson);
    expect(checkTaxonomies(o, r)).toEqual([]);
    const bad = { ...o, occasions: [...o.occasions, { ...o.occasions[0], related: ["nope"] }] };
    const errs = checkTaxonomies(bad, r);
    expect(errs).toContain(`duplicate occasion id ${o.occasions[0].id}`);
    expect(errs.some((e) => e.includes("bad related nope"))).toBe(true);
  });
});

describe("live supply + gates", () => {
  it("filters supply by state and category, never inventing any", () => {
    const s = snap([rec(), rec({ categoryId: "carousels", requestableStates: ["az"] })]);
    expect(supplyFor(s, { stateCode: "TX" })).toHaveLength(1);
    expect(supplyFor(s, { categories: ["carousels"] })).toHaveLength(1);
    expect(supplyFor(snap([]), { stateCode: "tx" })).toEqual([]);
  });

  it("nothing is indexable outside production with indexing on", () => {
    expect(stateGate(TX, snap(live(10))).indexable).toBe(false);
  });

  it("state page needs enough supply: operator inventory in the state, or live non-test offerings accepting requests there", () => {
    indexingOn();
    const n = PSEO_THRESHOLDS.stateMinOfferings;
    // Texas has operator inventory, so the (retired) managed catalog can be empty.
    expect(stateGate(TX, snap([]))).toEqual({ indexable: true, reasons: [] });
    // Alaska has none: only enough live, non-test managed offerings accepting requests there qualify it.
    const AK = stateBySlug("alaska")!;
    const ak = (k: number, over: Partial<CatalogRecord> = {}) => snap(live(k, { requestableStates: ["ak"], ...over }));
    expect(stateGate(AK, snap([])).indexable).toBe(false);
    expect(stateGate(AK, ak(n)).indexable).toBe(true);
    expect(stateGate(AK, ak(n - 1)).indexable).toBe(false);
    expect(stateGate(AK, ak(n, { isTestSample: true })).indexable).toBe(false);
    expect(stateGate(AK, snap(live(n))).indexable).toBe(false); // accepting requests in Texas only
    // Harness / error sources never count, even with enough records.
    expect(stateGate(AK, snap(live(n, { requestableStates: ["ak"] }), "test-harness-file")).indexable).toBe(false);
  });

  it("occasion pages are open (open indexing, founder 2026-10-27) and need supply in suggested categories", () => {
    // Closed with indexing off, whatever the supply.
    expect(occasionGate(approved("weddings"), snap(live(5))).indexable).toBe(false);
    indexingOn();
    // Draft copy is approved for indexing; supply is the operator inventory of the suggested categories
    // (the retired managed catalog can be empty). The waves-only rules are tested in pseo-pilot.test.ts.
    for (const o of OCCASIONS) {
      expect(o.reviewStatus, o.id).toBe("draft");
      expect(occasionGate(o, snap([])), o.id).toEqual({ indexable: true, reasons: [] });
    }
    // An occasion whose suggested categories have no supply at all stays noindex.
    const none = { ...approved("weddings"), suggestedCategories: ["no-inventory-category"] } as Occasion;
    expect(occasionGate(none, snap([])).reasons.join()).toMatch(/0 live offerings in suggested categories/);
  });

  it("the wedding page leads with Ferris wheels and carousels and links its guides", () => {
    const w = occasionById("weddings")!;
    expect(w.headline).toBe("Ferris wheel and carousel rentals for weddings");
    expect(w.guides).toEqual(["ferris-wheel-wedding-rental", "ferris-wheel-rental-cost"]);
  });

  it("occasion + state needs both parents and suggested supply near the state (what the page shows)", () => {
    indexingOn();
    const o = approved("weddings");
    // Operator inventory near Texas: the managed catalog can be empty.
    expect(occasionStateGate(o, TX, snap([]))).toEqual({ indexable: true, reasons: [] });
    // Alaska: no inventory nearby, and offerings elsewhere or in other categories don't count.
    const AK = stateBySlug("alaska")!;
    const elsewhere = snap([...live(5, { requestableStates: ["az"] }), ...live(5, { categoryId: "thrill-rides", requestableStates: ["ak"] })]);
    const g = occasionStateGate(o, AK, elsewhere);
    expect(g.indexable).toBe(false);
    expect(g.reasons.some((r) => r.includes("live suggested offerings accept requests in AK"))).toBe(true);
  });

  it("enumerates every state, occasion and combination with canonical paths", () => {
    const routes = pseoRoutes(snap([]));
    expect(routes).toHaveLength(GUIDES.length + 5 + 51 + OCCASIONS.length + OCCASIONS.length * 51); // guides, 5 pilot category hubs
    expect(routes.some((r) => r.path === "/new-york/bar-mitzvahs")).toBe(true);
    expect(routes.every((r) => !r.gate.indexable)).toBe(true);
  });
});

describe("routes + structured data", () => {
  it("builds canonical paths and request prefill links", () => {
    expect(paths.state("texas")).toBe("/texas");
    expect(paths.city("texas", "austin")).toBe("/texas/austin");
    expect(paths.rideCity("ferris-wheel-rental", "texas", "austin")).toBe("/texas/austin/ferris-wheel-rental");
    expect(paths.occasionState("bar-mitzvahs", "new-york")).toBe("/new-york/bar-mitzvahs");
    expect(paths.connect({ state: "texas", occasion: "bar-mitzvahs" })).toBe("/connect?state=texas&occasion=bar-mitzvahs");
    expect(() => paths.occasion("Bar Mitzvahs")).toThrow();
  });

  it("keeps the /{state}/… namespace collision-free", () => {
    expect(checkSlugNamespaces()).toEqual([]);
    expect(checkSlugNamespaces(["austin", "bar-mitzvahs"])).toEqual(['city slug "bar-mitzvahs" collides with occasion id']);
    expect(US_STATES.some((s) => RESERVED_TOP_LEVEL.includes(s.slug))).toBe(false);
  });

  it("emits no ratings or prices and cannot break out of the script tag", () => {
    const data = graph([
      breadcrumbs([{ name: "Home", path: "/" }]),
      rentalService({ name: "x", description: "y", path: "/texas", areaServed: { type: "State", name: "Texas" } }),
      itemList({ path: "/texas", name: "rides", cards: [cardFromCatalog(rec({ title: "</script><b>" }), { production: false })] }),
    ]);
    const json = serializeJsonLd(data);
    expect(json).not.toMatch(/aggregateRating|"price"|"review"/i);
    expect(json).not.toContain("</script>");
    expect(json).toContain('"legalName":"10000 Solutions LLC"');
  });
});
