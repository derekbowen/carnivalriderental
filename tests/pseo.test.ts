import { afterEach, describe, expect, it } from "vitest";
import type { CatalogRecord } from "@/lib/catalog/normalize";
import type { CatalogSnapshot } from "@/lib/catalog/source";
import { occasionGate, occasionStateGate, PSEO_THRESHOLDS, pseoRoutes, stateGate, supplyFor } from "@/lib/seo/pseo";
import { checkSlugNamespaces, RESERVED_TOP_LEVEL } from "@/lib/seo/namespaces";
import { paths } from "@/lib/seo/routes";
import { breadcrumbs, offeringList, rentalService, serializeJsonLd } from "@/lib/seo/structured-data";
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

  it("state page needs enough live, non-test offerings accepting requests there", () => {
    indexingOn();
    const n = PSEO_THRESHOLDS.stateMinOfferings;
    expect(stateGate(TX, snap(live(n))).indexable).toBe(true);
    expect(stateGate(TX, snap(live(n - 1))).indexable).toBe(false);
    expect(stateGate(TX, snap(live(n, { isTestSample: true }))).indexable).toBe(false);
    expect(stateGate(TX, snap(live(n, { requestableStates: ["ok"] }))).indexable).toBe(false);
    // Harness / error sources never count, even with enough records.
    expect(stateGate(TX, snap(live(n), "test-harness-file")).reasons.join()).toMatch(/supply source/);
  });

  it("occasion pages need approved copy and supply in suggested categories", () => {
    indexingOn();
    const draft = occasionById("weddings")!;
    expect(occasionGate(draft, snap(live(5))).reasons).toContain("occasion copy not approved");
    const ok = approved("weddings");
    expect(occasionGate(ok, snap(live(5))).indexable).toBe(true);
    expect(occasionGate(ok, snap(live(5, { categoryId: "thrill-rides" }))).indexable).toBe(false);
  });

  it("occasion + state needs both parents and local suggested supply", () => {
    indexingOn();
    const o = approved("weddings");
    expect(occasionStateGate(o, TX, snap(live(5))).indexable).toBe(true);
    const elsewhere = snap([...live(5, { requestableStates: ["az"] }), ...live(5, { categoryId: "thrill-rides" })]);
    const g = occasionStateGate(o, TX, elsewhere);
    expect(g.indexable).toBe(false);
    expect(g.reasons.some((r) => r.includes("live suggested offerings accept requests in TX"))).toBe(true);
  });

  it("enumerates every state, occasion and combination with canonical paths", () => {
    const routes = pseoRoutes(snap([]));
    expect(routes).toHaveLength(51 + OCCASIONS.length + OCCASIONS.length * 51);
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
    expect(paths.request(undefined, "texas", undefined, "bar-mitzvahs")).toBe("/request?state=texas&occasion=bar-mitzvahs");
    expect(() => paths.occasion("Bar Mitzvahs")).toThrow();
  });

  it("keeps the /{state}/… namespace collision-free", () => {
    expect(checkSlugNamespaces()).toEqual([]);
    expect(checkSlugNamespaces(["austin", "bar-mitzvahs"])).toEqual(['city slug "bar-mitzvahs" collides with occasion id']);
    expect(US_STATES.some((s) => RESERVED_TOP_LEVEL.includes(s.slug))).toBe(false);
  });

  it("emits no ratings or prices and cannot break out of the script tag", () => {
    const data = [
      breadcrumbs([{ name: "Home", path: "/" }]),
      rentalService({ name: "x", description: "y", path: "/texas", areaServed: { type: "State", name: "Texas" } }),
      offeringList("rides", [rec({ title: "</script><b>" })], () => "/preview/rides/x"),
    ];
    const json = serializeJsonLd(data);
    expect(json).not.toMatch(/aggregateRating|"price"|"review"/i);
    expect(json).not.toContain("</script>");
    expect(json).toContain('"legalName":"10000 Solutions LLC"');
  });
});
