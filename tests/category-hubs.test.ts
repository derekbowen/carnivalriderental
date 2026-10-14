import { afterEach, describe, expect, it } from "vitest";
import { cardFromCatalog, cardFromFixture, structuredDataCards } from "@/lib/catalog/card";
import type { CatalogRecord } from "@/lib/catalog/normalize";
import type { CatalogSnapshot } from "@/lib/catalog/source";
import { CATEGORY_PAGES, categoryPageById, checkCategoryPages, type CategoryPage } from "@/lib/content/category-pages";
import { demoContent } from "@/lib/content/demo/fixtures";
import { categoryHubGate, PSEO_THRESHOLDS } from "@/lib/seo/pseo";
import { breadcrumbs, faqPage, graph, ids, itemList, rentalService, serializeJsonLd, webPage } from "@/lib/seo/structured-data";

const rec = (over: Partial<CatalogRecord> = {}): CatalogRecord => ({
  offerKey: `ofr-${Math.random().toString(36).slice(2, 8)}`,
  listingId: "x",
  slug: "ferris-wheel-rental",
  title: "Ferris wheel rental",
  description: "Managed Ferris wheel rental: we source the wheel and crew.",
  categoryId: "ferris-wheels",
  requestableStates: ["tx"],
  eventTypes: null,
  pricing: { mode: "quote-required" },
  isTestSample: false,
  withheld: [],
  ...over,
});
const snap = (records: CatalogRecord[], source: CatalogSnapshot["source"] = "sharetribe-marketplace-api"): CatalogSnapshot => ({ records, rejected: [], fetchedAt: "", source });
const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});
const production = () => {
  process.env.APP_ENV = "production";
  process.env.PUBLIC_INDEXING = "true";
};
const copyOf = (p: CategoryPage) => [p.h1, p.metaTitle, p.metaDescription, p.intro, p.heroAlt, ...Object.values(p.planning), ...p.quoteChecklist, ...p.faqs.flatMap((f) => [f.q, f.a])];

describe("category page config", () => {
  it("covers exactly the five pilot categories, structurally valid, all draft", () => {
    expect(CATEGORY_PAGES.map((p) => p.id)).toEqual(["ferris-wheels", "carousels", "swing-rides", "thrill-rides", "kiddie-rides"]);
    expect(checkCategoryPages()).toEqual([]);
    expect(CATEGORY_PAGES.every((p) => p.reviewStatus === "draft")).toBe(true);
    expect(new Set(CATEGORY_PAGES.map((p) => p.theme)).size).toBe(5);
  });

  it("contains no numbers at all: no invented heights, capacities, rider minimums, power or prices", () => {
    for (const p of CATEGORY_PAGES) for (const t of copyOf(p)) expect(t, `${p.id}: ${t}`).not.toMatch(/\d/);
  });

  it("makes no availability, insurance, certification or review claims", () => {
    for (const p of CATEGORY_PAGES)
      for (const t of copyOf(p)) expect(t, `${p.id}: ${t}`).not.toMatch(/\b(insured|insurance|certified|available now|in stock|reviews?|rated|guarantee)/i);
  });

  it("merry-go-round lives inside the carousel page only (one page per intent)", () => {
    const carousel = categoryPageById("carousels")!;
    expect(copyOf(carousel).join(" ")).toMatch(/merry-go-round/i);
    expect(carousel.h1).toMatch(/merry-go-round/i);
    for (const p of CATEGORY_PAGES.filter((x) => x.id !== "carousels")) expect(copyOf(p).join(" "), p.id).not.toMatch(/merry-go-round/i);
  });
});

describe("shared listing card", () => {
  it("catalog cards link to the dev preview outside production and nowhere in production", () => {
    expect(cardFromCatalog(rec(), { production: false }).detail).toEqual({ href: "/preview/rides/ferris-wheel-rental", kind: "preview" });
    expect(cardFromCatalog(rec(), { production: true }).detail).toBeNull();
  });

  it("shows an estimate only when approved (normalised) and keeps test labels", () => {
    expect(cardFromCatalog(rec()).estimate).toBeNull();
    const priced = cardFromCatalog(rec({ pricing: { mode: "indicative-range", lowUsd: 100, highUsd: 200, basis: "Approved basis" } }));
    expect(priced.estimate).toEqual({ lowUsd: 100, highUsd: 200, basis: "Approved basis" });
    expect(cardFromCatalog(rec({ isTestSample: true })).sampleLabel).toBe("Test sample");
  });

  it("fixture cards are labelled, never priced from demo values, and carry at most two verified specs", () => {
    for (const ride of demoContent.rides) {
      const c = cardFromFixture(ride);
      expect(c.sampleLabel).toBe("Demo record");
      expect(c.estimate).toBeNull();
      expect(c.specs.length).toBeLessThanOrEqual(2);
      expect(c.photo).toBeNull(); // dev placeholders are not photos
    }
    const withSpecs = { ...demoContent.rides[0], specs: [
      { label: "A", value: "1", verification: { status: "verified" as const, source: "s" } },
      { label: "B", value: null, verification: { status: "unverified" as const } },
      { label: "C", value: "3", verification: { status: "verified" as const, source: "s" } },
      { label: "D", value: "4", verification: { status: "verified" as const, source: "s" } },
    ] };
    expect(cardFromFixture(withSpecs).specs).toEqual([{ label: "A", value: "1" }, { label: "C", value: "3" }]);
  });

  it("production structured data keeps real supply only", () => {
    const real = cardFromCatalog(rec(), { production: true });
    const test = cardFromCatalog(rec({ isTestSample: true }), { production: true });
    const fixture = cardFromFixture(demoContent.rides[0]);
    expect(structuredDataCards([real, test, fixture], snap([]), true)).toEqual([real]);
    expect(structuredDataCards([real, test, fixture], snap([], "test-harness-file"), true)).toEqual([]);
    expect(structuredDataCards([real, test, fixture], snap([]), false)).toHaveLength(3);
  });
});

describe("category hub gate", () => {
  const ferris = categoryPageById("ferris-wheels")!;
  const n = PSEO_THRESHOLDS.categoryMinOfferings;

  it("visual theme or copy alone never qualifies a hub", () => {
    production();
    expect(categoryHubGate(ferris, snap([])).indexable).toBe(false);
    expect(categoryHubGate({ ...ferris, reviewStatus: "approved" }, snap([])).indexable).toBe(false);
    expect(categoryHubGate({ ...ferris, theme: "thrill" }, snap(Array.from({ length: n }, () => rec()))).reasons).toContain("category copy not approved");
  });

  it("approved copy + enough real supply in the category → indexable; test samples and other categories don't count", () => {
    production();
    const ok = { ...ferris, reviewStatus: "approved" as const };
    expect(categoryHubGate(ok, snap(Array.from({ length: n }, () => rec()))).indexable).toBe(true);
    expect(categoryHubGate(ok, snap(Array.from({ length: n }, () => rec({ isTestSample: true })))).indexable).toBe(false);
    expect(categoryHubGate(ok, snap(Array.from({ length: n }, () => rec({ categoryId: "carousels" })))).indexable).toBe(false);
  });

  it("never indexable outside production", () => {
    expect(categoryHubGate({ ...ferris, reviewStatus: "approved" }, snap(Array.from({ length: n }, () => rec()))).indexable).toBe(false);
  });
});

describe("structured data graph", () => {
  it("connects CollectionPage, BreadcrumbList, Service, ItemList and FAQ to one Organization by @id", () => {
    const path = "/categories/ferris-wheels";
    const cards = [cardFromCatalog(rec({ title: "Ferris wheel rental" }), { production: false }), cardFromCatalog(rec({ slug: "big-wheel", title: "Big wheel" }), { production: false })];
    const g = graph([
      webPage({ path, name: "Ferris wheel rentals", description: "d", hasItemList: true, hasService: true }),
      breadcrumbs([{ name: "Home", path: "/" }, { name: "Rides", path: "/rides" }, { name: "Ferris wheels", path }]),
      rentalService({ path, name: "Ferris wheel rentals", description: "d" }),
      itemList({ path, name: "Ferris wheels you can request", cards }),
      faqPage([{ q: "Q?", a: "An answer that is long enough." }], path),
    ]) as { "@graph": Record<string, unknown>[] };
    const nodes = g["@graph"];
    const byType = (t: string) => nodes.find((n) => n["@type"] === t)!;
    const allIds = new Set(nodes.map((n) => n["@id"]));
    // every @id reference resolves inside the graph
    const refs = JSON.stringify(nodes).match(/\{"@id":"[^"]+"\}/g) ?? [];
    for (const r of refs) expect(allIds.has(JSON.parse(r)["@id"])).toBe(true);
    expect(byType("CollectionPage").mainEntity).toEqual({ "@id": ids.itemList(path) });
    expect(byType("Service").provider).toEqual({ "@id": ids.organization() });
    const list = byType("ItemList") as { itemListElement: { name: string; url?: string; position: number }[] };
    expect(list.itemListElement.map((i) => [i.position, i.name, i.url?.endsWith(`/preview/rides/${i.name === "Big wheel" ? "big-wheel" : "ferris-wheel-rental"}`)])).toEqual([
      [1, "Ferris wheel rental", true],
      [2, "Big wheel", true],
    ]);
    const json = serializeJsonLd(g);
    expect(json).not.toMatch(/"offers"|"price"|aggregateRating|"review"|"Event"|"address"/);
  });

  it("omits ListItem urls when the card shows no link (production preview targets)", () => {
    const l = itemList({ path: "/x", name: "n", cards: [cardFromCatalog(rec(), { production: true })] }) as { itemListElement: Record<string, unknown>[] };
    expect(l.itemListElement[0]).not.toHaveProperty("url");
  });
});
