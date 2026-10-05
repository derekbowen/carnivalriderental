import { expect, test } from "@playwright/test";

/**
 * Phone-size checks for the web build that the iOS/Android (Capacitor) shell will load.
 * 390×844 = iPhone 14/15; touch enabled.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

// Occasion pages are ISR-cached on first view; use ones no other spec seeds with test supply.
const PAGES = ["/", "/rides", "/rides/ferris-wheel-rental", "/texas", "/texas/austin", "/ohio/school-carnivals", "/events/company-picnics", "/operators", "/request"];

test("key pages fit a phone screen with no sideways scrolling", async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
  }
});

test("app-shell ready: edge-to-edge viewport, theme colour, no zoom-on-focus inputs", async ({ page }) => {
  await page.goto("/operators");
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#0b1b3f");
  // iOS zooms into any input under 16px; that breaks the app feel.
  const sizes = await page.locator("input:not([type=checkbox]):not([type=hidden]), select, textarea").evaluateAll((els) =>
    els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => parseFloat(getComputedStyle(e).fontSize)),
  );
  expect(sizes.length).toBeGreaterThan(0);
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(16);
});

test("mobile menu opens with a finger-sized button and reaches the main pages", async ({ page }) => {
  await page.goto("/");
  const menu = page.getByLabel("Menu");
  const box = await menu.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await menu.tap();
  await page.getByRole("banner").getByRole("link", { name: "Find a ride" }).tap();
  await expect(page).toHaveURL(/\/s$/);
});
