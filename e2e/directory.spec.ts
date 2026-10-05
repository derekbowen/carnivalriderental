import { expect, test } from "@playwright/test";

test("site directory: header and footer link to it; states, cities, ride types and listings resolve", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Locations" })).toHaveAttribute("href", "/directory");
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Site directory" })).toHaveAttribute("href", "/directory");

  await page.goto("/directory");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Site directory");
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Directory");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await page.getByRole("main").getByRole("link", { name: "Ohio", exact: true }).click();
  await expect(page).toHaveURL(/\/directory\/ohio$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ohio directory");
  const main = page.getByRole("main");
  await expect(main.getByRole("link", { name: "Carnival rides near Columbus" })).toHaveAttribute("href", "/ohio/columbus");
  await expect(main.getByRole("link", { name: /^Ferris wheel \(\d+\)$/ }).first()).toBeVisible();
  const hrefs = [...new Set(await main.getByRole("link").evaluateAll((as) => as.map((a) => a.getAttribute("href")!)))];
  const sample = [...hrefs.filter((h) => h.startsWith("/ohio/")).slice(0, 25), ...hrefs.filter((h) => h.startsWith("/s/")).slice(0, 3)];
  for (const h of sample) expect((await request.get(h)).status(), h).toBe(200);
  expect((await request.get("/directory/not-a-state")).status()).toBe(404);
});

test("listing detail: breadcrumbs to its state, city and ride-type page, and links back to them", async ({ page }) => {
  await page.goto("/ohio/columbus/ferris-wheel");
  const href = await page.locator('[data-testid="ride-result"]').first().getByRole("link", { name: "View ride details" }).getAttribute("href");
  await page.goto(href!);
  const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(crumbs.getByRole("link", { name: "Ohio" })).toHaveAttribute("href", "/ohio");
  await expect(crumbs.getByRole("link", { name: "Ferris wheel rentals" })).toHaveAttribute("href", /^\/ohio\/[a-z-]+\/ferris-wheel$/);
  await expect(page.getByRole("link", { name: /^Ferris wheel rentals near / }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "All ride listings from operators based in Ohio" })).toHaveAttribute("href", "/directory/ohio");
  await expect(page.getByText("contacts the operator")).toHaveCount(0);
});

test("breadcrumbs on ride types and search", async ({ page }) => {
  for (const [path, last] of [["/rides", "Ride types"], ["/s", "Find a ride"]] as const) {
    await page.goto(path);
    await expect(page.getByRole("navigation", { name: "Breadcrumb" }).locator('[aria-current="page"]')).toHaveText(last);
  }
});
