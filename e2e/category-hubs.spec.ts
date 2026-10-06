import fs from "node:fs";
import { expect, test } from "@playwright/test";

/**
 * Five pilot category hubs on one template. Supply comes from the labelled test harness
 * (data/e2e-catalog.json, Test samples) plus development fixtures — never live listings.
 */
const FILE = "data/e2e-catalog.json";
const CATS = ["ferris-wheels", "carousels", "swing-rides", "thrill-rides", "kiddie-rides"];
const binding = { listingType: "managed-ride-rental", transactionProcessAlias: "default-negotiation/release-1", unitType: "offer" };

test.beforeAll(() => {
  const samples = JSON.parse(fs.readFileSync("catalog/test-samples.json", "utf8")).samples as { title: string; description: string; publicData: object; metadata: object }[];
  fs.writeFileSync(
    FILE,
    JSON.stringify({ data: samples.map((s, i) => ({ id: `dddddddd-0000-0000-0000-00000000000${i + 1}`, attributes: { title: s.title, description: s.description, state: "published", publicData: { ...binding, ...s.publicData }, metadata: s.metadata } })) }),
  );
});
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
    // listings → planning → sourcing → FAQ → related → final CTA
    const order = [idx(/you can request$/), idx(/^Planning a /), idx(/^How sourcing and quotes work$/), idx(/^Frequently asked questions$/), idx(/^Related ride types$/), idx(/at your event\?$/)];
    expect(order.every((n) => n >= 0), `${c}: ${headings.join(" | ")}`).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  }
  expect((await request.get("/categories/merry-go-rounds")).status()).toBe(404);
  expect((await request.get("/categories/family-rides")).status()).toBe(404);
});

test("cards: test samples labelled, fixtures separated, pricing and sourcing text, destinations resolve", async ({ page, request }) => {
  await page.goto("/categories/ferris-wheels");
  const live = page.getByTestId("supply-list").getByTestId("listing-card");
  await expect(live).toHaveCount(1);
  await expect(live.first()).toContainText("Test sample");
  await expect(live.first()).toContainText("Priced by the operator");
  await expect(live.first()).toContainText("Sourcing on request");
  await expect(live.first().getByRole("img")).toHaveAttribute("alt", /Illustration of ferris wheels — not a photo of a specific ride/);
  await expect(page.getByTestId("fixture-cards")).toContainText("not live listings");
  await expect(page.getByTestId("fixture-cards").getByTestId("listing-card").first()).toContainText("Demo record");
  // No promotional badges, ratings or booking claims anywhere on the cards.
  for (const t of await page.getByTestId("listing-card").allInnerTexts()) expect(t).not.toMatch(/popular|top rated|★|instant|book now|favorite/i);
  // Every details link resolves.
  const hrefs = await page.getByTestId("listing-card").getByRole("link").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
  expect(hrefs).toEqual(["/preview/rides/test-ferris-wheel-rental", "/rides/ferris-wheel-rental"]);
  for (const h of hrefs) expect((await request.get(h)).status(), h).toBe(200);
  await expect(page.getByTestId("listing-card").getByRole("link").first()).toHaveText(/dev preview/);
});

test("empty state: thrill rides has no supply and says so", async ({ page }) => {
  await page.goto("/categories/thrill-rides");
  await expect(page.getByTestId("supply-empty")).toContainText("No thrill ride listings are published yet");
  await expect(page.getByTestId("listing-card")).toHaveCount(0);
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
