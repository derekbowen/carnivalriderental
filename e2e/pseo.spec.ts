import fs from "node:fs";
import { expect, test } from "@playwright/test";

/**
 * Taxonomy-driven page families: state hubs, occasion hubs, occasion + state.
 * Supply comes from the labelled test harness (data/e2e-catalog.json), never live Sharetribe.
 */
const FILE = "data/e2e-catalog.json";
const binding = { listingType: "managed-ride-rental", transactionProcessAlias: "default-negotiation/release-1", unitType: "offer" };
const listing = (n: number, title: string, category: string, offerKey: string, states: string[]) => ({
  id: `bbbbbbbb-0000-0000-0000-00000000000${n}`,
  attributes: {
    title,
    description: "TEST LISTING — not a real offer.",
    state: "published",
    publicData: { ...binding, categoryLevel1: category },
    metadata: { offerKey, offeringScope: "ride-family", requestableStates: states, pricingMode: "quote-required" },
  },
});

test.beforeAll(() => {
  fs.writeFileSync(
    FILE,
    JSON.stringify({
      data: [
        listing(1, "[TEST] Ferris wheel rental", "ferris-wheels", "ofr-test-ferris-wheel-family", ["tx"]),
        listing(2, "[TEST] Carousel rental", "carousels", "ofr-test-carousel-family", ["az"]),
      ],
    }),
  );
});
test.afterAll(() => fs.rmSync(FILE, { force: true }));

const jsonLdTypes = async (page: import("@playwright/test").Page) =>
  (await page.locator('script[type="application/ld+json"]').allTextContents()).flatMap((t) => (JSON.parse(t) as { "@graph": { "@type": string }[] })["@graph"].map((d) => d["@type"]));

test("state hub renders for every state, noindex, with structured data and occasion links", async ({ page, request }) => {
  for (const s of ["texas", "district-of-columbia", "wyoming"]) expect((await request.get(`/${s}`)).status()).toBe(200);
  expect((await request.get("/atlantis")).status()).toBe(404);
  await page.goto("/texas");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Carnival ride rentals in Texas");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByRole("link", { name: "Carnival rides for bar mitzvahs" })).toHaveAttribute("href", "/texas/bar-mitzvahs");
  expect(await jsonLdTypes(page)).toEqual(expect.arrayContaining(["BreadcrumbList", "Service", "FAQPage"]));
});

test("occasion + state lists live supply in suggested categories first, labelled, and 404s unknown slugs", async ({ page, request }) => {
  expect((await request.get("/atlantis/bar-mitzvahs")).status()).toBe(404);
  expect((await request.get("/texas/unicorn-parties")).status()).toBe(404);

  await page.goto("/texas/bar-mitzvahs");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Carnival ride rentals for bar mitzvahs in Texas");
  await expect(page.getByTestId("supply-list").first()).toContainText("[TEST] Ferris wheel rental");
  await expect(page.getByText("Test sample").first()).toBeVisible();
  await expect(page.getByTestId("supply-source")).toContainText("test-harness-file");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  expect(await jsonLdTypes(page)).toEqual(expect.arrayContaining(["BreadcrumbList", "Service", "ItemList", "FAQPage"]));
  await expect(page.getByRole("main").getByRole("link", { name: "Connect with operators" }).first()).toHaveAttribute("href", "/connect?state=texas&occasion=bar-mitzvahs");

  // Arizona: the carousel is not a suggested category for bar mitzvahs, so it is listed under "other rides";
  // the Texas-only Ferris wheel does not appear at all.
  await page.goto("/arizona/bar-mitzvahs");
  await expect(page.getByTestId("supply-empty")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Other rides you can request in Arizona" })).toBeVisible();
  await expect(page.locator("main")).not.toContainText("[TEST] Ferris wheel rental");
});

test("occasion hub and index render and link to every state", async ({ page, request }) => {
  expect((await request.get("/events")).status()).toBe(200);
  await page.goto("/events/quinceaneras");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Carnival ride rentals for quinceañeras");
  await expect(page.getByRole("main").getByRole("link", { name: "District of Columbia" })).toHaveAttribute("href", "/district-of-columbia/quinceaneras");
});

test("old prefixed URLs redirect permanently to the direct ones", async ({ request }) => {
  for (const [from, to] of [
    ["/locations/texas", "/texas"],
    ["/locations/texas/austin", "/texas/austin"],
    ["/rides/ferris-wheel-rental/texas/austin", "/texas/austin/ferris-wheel-rental"],
    ["/events/bar-mitzvahs/texas", "/texas/bar-mitzvahs"],
  ]) {
    const r = await request.get(from, { maxRedirects: 0 });
    expect(r.status(), from).toBe(308);
    expect(r.headers()["location"], from).toBe(to);
  }
  expect((await request.get("/texas/austin/not-a-ride")).status()).toBe(404);
});
