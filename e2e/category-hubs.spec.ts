import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { HARNESS_FILE, writeCategorySamples } from "./harness";

/**
 * Five pilot category hubs on one template. Supply is the operator inventory snapshot (real
 * listings, no identity) plus the labelled test harness (data/e2e-catalog.json, Test samples).
 * Demo fixtures never appear.
 */
const FILE = HARNESS_FILE;
const CATS = ["ferris-wheels", "carousels", "swing-rides", "thrill-rides", "kiddie-rides"];

test.beforeAll(() => writeCategorySamples(FILE));
test.afterAll(() => fs.rmSync(FILE, { force: true }));

type Node = Record<string, unknown> & { "@type": string };
const graphOf = async (page: import("@playwright/test").Page) => {
  const scripts = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(scripts).toHaveLength(1);
  return (JSON.parse(scripts[0]) as { "@graph": Node[] })["@graph"];
};

test("all five hubs render the shared template, noindex, with themed hero and section order", async ({ page, request }) => {
  for (const c of CATS) {
    const res = await request.get(`/categories/${c}`);
    expect(res.status(), c).toBe(200);
    expect(res.headers()["x-robots-tag"]).toContain("noindex");
    await page.goto(`/categories/${c}`);
    await expect(page.locator("[data-cat-theme]")).toHaveCount(1);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    const headings = await page.locator("main h2").allTextContents();
    const idx = (re: RegExp) => headings.findIndex((h) => re.test(h));
    // listings → planning → how Event Access works → FAQ → related → final CTA
    const order = [idx(/you can request$/), idx(/^Planning a /), idx(/^How Event Access works$/), idx(/^Frequently asked questions$/), idx(/^Related ride types$/), idx(/at your event\?$/)];
    expect(order.every((n) => n >= 0), `${c}: ${headings.join(" | ")}`).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  }
  expect((await request.get("/categories/merry-go-rounds")).status()).toBe(404);
  expect((await request.get("/categories/family-rides")).status()).toBe(404);
});

test("cards: real inventory first, test samples labelled, no demo fixtures, pricing and sourcing text, destinations resolve", async ({ page, request }) => {
  await page.goto("/categories/ferris-wheels");
  // Inventory: real operator listings of the category, linking to our own listing pages.
  const inventory = page.getByTestId("inventory-cards").getByTestId("ride-result");
  expect(await inventory.count()).toBeGreaterThanOrEqual(6);
  await expect(page.getByTestId("inventory-line")).toContainText(/\d+ Ferris wheel listings from independent operators nationwide/);
  await expect(page.getByTestId("inventory-types")).toContainText("Ferris wheel");
  const rideHrefs = await inventory.getByRole("link").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
  expect(rideHrefs.filter((h) => h.startsWith("/s/")).length).toBeGreaterThanOrEqual(6);
  expect((await request.get(rideHrefs.find((h) => h.startsWith("/s/"))!)).status()).toBe(200);
  // Managed-catalog test sample, labelled.
  const live = page.getByTestId("supply-list").getByTestId("listing-card");
  await expect(live).toHaveCount(1);
  await expect(live.first()).toContainText("Test sample");
  await expect(live.first()).toContainText("Priced by the operator");
  await expect(live.first()).toContainText("Availability confirmed by the operator");
  await expect(live.first().getByRole("img")).toHaveAttribute("alt", /Illustration of ferris wheels — not a photo of a specific ride/);
  // Demo fixtures are gone from category navigation.
  await expect(page.getByTestId("fixture-cards")).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText(/Demo record|published yet/);
  // No promotional badges, ratings or booking claims anywhere on the cards.
  for (const t of [...(await page.getByTestId("listing-card").allInnerTexts()), ...(await inventory.allInnerTexts())]) expect(t).not.toMatch(/popular|top rated|★|instant|book now|favorite/i);
  // Every details link resolves.
  const hrefs = await page.getByTestId("listing-card").getByRole("link").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
  expect(hrefs).toEqual(["/preview/rides/test-ferris-wheel-rental"]);
  for (const h of hrefs) expect((await request.get(h)).status(), h).toBe(200);
  await expect(page.getByTestId("listing-card").getByRole("link").first()).toHaveText(/dev preview/);
});

test("no empty-inventory messaging: thrill rides has no managed-catalog supply but shows real inventory", async ({ page }) => {
  await page.goto("/categories/thrill-rides");
  await expect(page.getByTestId("supply-empty")).toHaveCount(0);
  await expect(page.getByTestId("listing-card")).toHaveCount(0);
  expect(await page.getByTestId("inventory-cards").getByTestId("ride-result").count()).toBeGreaterThanOrEqual(6);
  await expect(page.locator("main")).not.toContainText(/published yet|Demo record/);
});

test("JSON-LD graph mirrors the visible page: breadcrumbs, cards (order + URLs) and FAQs", async ({ page }) => {
  await page.goto("/categories/carousels");
  const g = await graphOf(page);
  const byType = (t: string) => g.find((n) => n["@type"] === t && !String(n["@id"]).endsWith("/operators#service"))!;
  expect(g.map((n) => n["@type"]).sort()).toEqual(["BreadcrumbList", "CollectionPage", "FAQPage", "ItemList", "Organization", "Service", "Service", "WebSite"]); // customer + operator Service

  const crumbs = (byType("BreadcrumbList").itemListElement as { name: string }[]).map((i) => i.name);
  expect(crumbs).toEqual(await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("listitem").allInnerTexts());

  const items = byType("ItemList").itemListElement as { name: string; url?: string }[];
  const cardNames = await page.getByTestId("listing-card").locator("h3").allInnerTexts();
  expect(items.map((i) => i.name)).toEqual(cardNames);
  const cardHrefs = await page.getByTestId("listing-card").getByRole("link").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
  expect(items.map((i) => new URL(i.url!).pathname)).toEqual(cardHrefs);

  const faqs = (byType("FAQPage").mainEntity as { name: string }[]).map((q) => q.name);
  expect(faqs).toEqual(await page.locator("dl dt").allInnerTexts());
  expect(JSON.stringify(g)).not.toMatch(/"offers"|"price"|aggregateRating|"review"|"address"/);
  await expect(page.locator("main")).toContainText("merry-go-round");
});

test("connect CTA carries the ride type into Event Access", async ({ page }) => {
  await page.goto("/categories/carousels");
  const cta = page.locator("main").getByRole("link", { name: "Connect with operators" }).first();
  await expect(cta).toHaveAttribute("href", "/connect?category=carousels");
  await page.goto("/connect?category=carousels");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Connect with carousel operators");
  await expect(page.locator('input[name="rideType"]')).toHaveValue("carousel");
});

test("mobile: no sideways scroll on any hub, hero CTA visible above the fold", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  for (const c of CATS) {
    await page.goto(`/categories/${c}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), c).toBeLessThanOrEqual(0);
    await expect(page.locator("main").getByRole("link", { name: "Connect with operators" }).first()).toBeInViewport();
  }
  await ctx.close();
});
