import fs from "node:fs";
import { expect, test } from "@playwright/test";

/**
 * Renders Sharetribe-shaped listings through the shared catalog adapter → preview pages.
 * Source is the labelled test harness (data/e2e-catalog.json), NOT live Sharetribe data;
 * the live chain is proven separately by catalog:seed + catalog:search-proof against Test.
 */
const FILE = "data/e2e-catalog.json";
const binding = { listingType: "managed-ride-rental", transactionProcessAlias: "default-negotiation/release-1", unitType: "offer" };
const base = () => ({
  data: [
    {
      id: "aaaaaaaa-0000-0000-0000-000000000001",
      attributes: {
        title: "[TEST] Ferris wheel rental",
        description: "TEST LISTING — not a real offer.",
        state: "published",
        publicData: { ...binding, categoryLevel1: "ferris-wheels" },
        metadata: { offerKey: "ofr-test-ferris-wheel-family", offeringScope: "ride-family", requestableStates: ["tx"], eventTypes: ["festival"], pricingMode: "quote-required" },
        // Must never reach output, even if a source returned it.
        privateData: { supplierCost: 12345, operatorName: "SECRET OPERATOR LLC" },
      },
    },
    {
      id: "aaaaaaaa-0000-0000-0000-000000000002",
      attributes: {
        title: "[TEST] Carousel rental",
        description: "TEST LISTING — not a real offer.",
        state: "published",
        publicData: { ...binding, categoryLevel1: "carousels" },
        metadata: { offerKey: "ofr-test-carousel-family", offeringScope: "ride-family", requestableStates: ["az"], pricingMode: "quote-required" },
      },
    },
  ],
});
const write = (d: unknown) => fs.writeFileSync(FILE, JSON.stringify(d));

test.beforeEach(() => write(base()));
test.afterAll(() => fs.rmSync(FILE, { force: true }));

test("custom listing page renders the normalised record, labelled, noindex, with unknowns absent", async ({ page, request }) => {
  const res = await request.get("/preview/rides/test-ferris-wheel-rental");
  expect(res.status()).toBe(200);
  expect(res.headers()["x-robots-tag"]).toContain("noindex");
  await page.goto("/preview/rides/test-ferris-wheel-rental");
  await expect(page.getByTestId("preview-banner")).toContainText("test-harness-file");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("[TEST] Ferris wheel rental");
  await expect(page.getByText("Test sample").first()).toBeVisible();
  await expect(page.getByText("Festival / fair")).toBeVisible();
  await expect(page.getByTestId("specs-unknown")).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const html = await page.content();
  expect(html).not.toMatch(/SECRET OPERATOR|12345|supplierCost/);
  // Only covered locations are linked.
  await expect(page.getByRole("main").getByRole("link", { name: "Austin, TX" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Denver, CO" })).toHaveCount(0);
});

test("pSEO preview: covered city renders, uncovered city is 404", async ({ request, page }) => {
  expect((await request.get("/preview/rides/test-ferris-wheel-rental/texas/austin")).status()).toBe(200);
  expect((await request.get("/preview/rides/test-ferris-wheel-rental/colorado/denver")).status()).toBe(404);
  expect((await request.get("/preview/rides/test-carousel-rental/texas/austin")).status()).toBe(404);
  await page.goto("/preview/rides/test-ferris-wheel-rental/texas/austin");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("[TEST] Ferris wheel rental in Austin, TX");
  await expect(page.getByText("subject to availability").first()).toBeVisible();
});

test("an edit to the source updates the dependent pages", async ({ page }) => {
  const d = base();
  d.data[0].attributes.title = "[TEST] Ferris wheel rental (edited)";
  d.data[0].attributes.metadata.requestableStates = ["co"];
  write(d);
  await page.goto("/preview/rides/test-ferris-wheel-rental");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("[TEST] Ferris wheel rental (edited)");
  await expect(page.getByRole("main").getByRole("link", { name: "Denver, CO" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Austin, TX" })).toHaveCount(0);
  const r = await page.request.get("/preview/rides/test-ferris-wheel-rental/texas/austin");
  expect(r.status()).toBe(404);
});

test("an invalid source record (Console edit) cannot become content", async ({ request }) => {
  const d = base();
  (d.data[0].attributes.metadata as Record<string, unknown>).poolAmenities = ["slide"];
  write(d);
  expect((await request.get("/preview/rides/test-ferris-wheel-rental")).status()).toBe(404);
  const d2 = base();
  delete (d2.data[0].attributes.metadata as Record<string, unknown>).requestableStates;
  write(d2);
  expect((await request.get("/preview/rides/test-ferris-wheel-rental")).status()).toBe(404);
});

test("preview pages are never in the sitemap", async ({ request }) => {
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain("/preview/");
});
