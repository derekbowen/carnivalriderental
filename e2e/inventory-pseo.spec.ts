import { expect, test } from "@playwright/test";

/**
 * Inventory pSEO pages (real US cities × the public ride snapshot). Runs offline: pages render from
 * src/lib/inventory/rides.json and src/lib/geo/cities.json, never from the marketplace API.
 */
const FORBIDDEN_SCHEMA = ["AggregateRating", "Review", "Offer", "LocalBusiness", "Event", "PostalAddress", "priceRange", "availability"];

async function jsonLd(page: import("@playwright/test").Page) {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(blocks.length).toBeGreaterThan(0);
  return blocks.map((b) => JSON.parse(b)); // throws on invalid JSON
}

test("city page: real supply, breadcrumbs, cards, links, visible-content-only schema", async ({ page, request }) => {
  const res = await request.get("/ohio/columbus");
  expect(res.status()).toBe(200);
  const html = await res.text();
  await page.goto("/ohio/columbus");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Carnival rides for your Columbus event.");
  await expect(page).toHaveTitle("Carnival Ride Rentals Near Columbus, OH | Carnival Ride Rental");
  await expect(page.getByTestId("inventory-line")).toHaveText(/^Browse [\d,]+ listings from operators based within 200 miles of Columbus\.$/);
  await expect(page.getByText("Distance is measured from operator home bases. Event availability and delivery must be confirmed.").first()).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Ohio");
  expect(await page.locator('[data-testid="ride-result"]').count()).toBe(12);
  await expect(page.getByText(/Operator ~\d+ mi away, based in [A-Z]{2}/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Connect with operators" }).first()).toBeVisible();
  // Cards: no repeated unclaimed paragraph, no dollar figure, no forbidden claims.
  const cards = (await page.locator('[data-testid="ride-result"]').allInnerTexts()).join("\n");
  expect(cards).not.toMatch(/\$\d|hasn.t joined|verified|partner|available|book now/i);
  expect(await page.locator("main").innerText()).not.toMatch(/\$\d|Estimated/);
  await expect(page.getByRole("link", { name: "View ride details" }).first()).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/ohio\/columbus$/);
  const ld = JSON.stringify(await jsonLd(page));
  expect(ld).toContain('"BreadcrumbList"');
  expect(ld).toContain('"ItemList"');
  for (const t of FORBIDDEN_SCHEMA) expect(ld).not.toContain(`"${t}"`);
  // No operator identity anywhere in the payload, visible or not.
  expect(html).not.toMatch(/Amusements|Attractions|Shows,|carnivalriderental\.us@/i);
  // A ride-type link from the city page resolves.
  const typeLink = page.getByRole("link", { name: /^Ferris wheel rentals \(\d+\)$/ });
  await expect(typeLink).toBeVisible();
  expect((await request.get((await typeLink.getAttribute("href"))!)).status()).toBe(200);
});

test("ride type + city: high-inventory page renders matching rides only", async ({ page }) => {
  await page.goto("/ohio/columbus/ferris-wheel");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ferris wheel rentals for your Columbus event.");
  await expect(page).toHaveTitle("Ferris Wheel Rentals Near Columbus, OH | Carnival Ride Rental");
  await expect(page.getByText("Give your guests a new view of the celebration. Explore Ferris wheel listings and connect with the operators that own them.")).toBeVisible();
  await expect(page.getByTestId("inventory-line")).toHaveText(/^Browse \d+ Ferris wheels? from operators based within 200 miles of Columbus\.$/);
  const titles = await page.locator('[data-testid="ride-result"] h2').allTextContents();
  expect(titles.length).toBeGreaterThanOrEqual(5);
  for (const t of titles) expect(t).toMatch(/wheel|ferris|eli/i);
  const ld = JSON.stringify(await jsonLd(page));
  for (const t of FORBIDDEN_SCHEMA) expect(ld).not.toContain(`"${t}"`);
});

test("carousel intro and singular/plural counts", async ({ page }) => {
  await page.goto("/texas/austin/carousel");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Carousel rentals for your Austin event.");
  await expect(page.getByText("Add a classic carnival favorite to your celebration. Explore carousel listings and connect with the operators that own them.")).toBeVisible();
  await expect(page.getByTestId("inventory-line")).toHaveText(/^Browse \d+ carousels? from operators based within 200 miles of Austin\.$/);
});

test("thin and invalid combinations: 404, never a thin indexable page", async ({ request, page }) => {
  // Ride type with too little supply near the city → 404 (not rendered as a thin page).
  expect((await request.get("/texas/austin/go-karts")).status()).toBe(404);
  // Unknown ride type, unknown city, unknown state → 404.
  expect((await request.get("/texas/austin/not-a-ride")).status()).toBe(404);
  expect((await request.get("/texas/not-a-city")).status()).toBe(404);
  expect((await request.get("/not-a-state/austin")).status()).toBe(404);
  // A real city with no operators nearby renders an honest empty state, noindex and no canonical.
  await page.goto("/alaska/anchorage");
  await expect(page.getByText(/don.t list operators based within \d+ miles of Anchorage/)).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  expect(await page.locator('link[rel="canonical"]').count()).toBe(0);
  expect(await page.locator('[data-testid="ride-result"]').count()).toBe(0);
});

test("sitemap holds no inventory URL until the founder approves copy and indexing", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  expect(xml).not.toMatch(/\/ohio\/columbus/);
  expect(xml).not.toMatch(/<loc>[^<]*\?/);
});
