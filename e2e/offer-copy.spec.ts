import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/**
 * The Event Access offer as customers read it (founder brief 2026-10-17): $99 / $199 for up to five
 * matching operator contacts, the exact number per search, direct contact and quotes, an access fee
 * with no commission or markup, and no ownership claims. Desktop and phone widths.
 */
const A_LISTING = (JSON.parse(fs.readFileSync("src/lib/inventory/rides.json", "utf8")) as { rides: { id: string }[] }).rides[0].id;
const PHONE = { width: 390, height: 844 };

async function noSideScroll(page: Page, label: string) {
  const { scroll, client, wide } = await page.evaluate(() => {
    const client = document.documentElement.clientWidth;
    // The innermost elements that stick out, so a failure names the culprit.
    const wide = [...document.querySelectorAll("body *")]
      .filter((el) => el.getBoundingClientRect().right > client + 1 && ![...el.children].some((c) => c.getBoundingClientRect().right > client + 1))
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}${el.getAttribute("data-testid") ? `[data-testid=${el.getAttribute("data-testid")}]` : ""}.${String(el.getAttribute("class") ?? "").split(" ").slice(0, 3).join(".")} "${(el.textContent ?? "").trim().slice(0, 40)}"`);
    return { scroll: document.documentElement.scrollWidth, client, wide };
  });
  expect(scroll, `${label}: page wider than the phone screen; sticking out: ${wide.join(" | ")}`).toBeLessThanOrEqual(client);
}

test("connect page states both tiers, up to five contacts, direct quotes and no commission or markup", async ({ page }) => {
  await page.goto("/connect");
  const terms = page.getByTestId("connect-terms");
  await expect(terms).toContainText("$99 for up to 5 matching carnival ride operator contacts, for one event.");
  await expect(terms).toContainText("$199 for up to 5 matching Ferris wheel operator contacts (standard, giant or mini), for one event.");
  await expect(terms).toContainText("the offer states exactly how many contacts you get");
  await expect(terms).toContainText("You contact each operator directly, compare their quotes and arrange the rental with them");
  await expect(terms).toContainText("No commission or markup on the rental price.");
  await expect(terms.getByRole("link", { name: "how to tell a ride owner from a rental broker" })).toHaveAttribute("href", "/guides/ride-owner-vs-rental-broker");
  await expect(page.locator("main")).not.toContainText(/\b(own|owns) (and run )?(their|the) rides?\b/);
});

test("ride listing page: up to five contacts, direct quotes, no markup, guide link, no ownership claim", async ({ page }) => {
  await page.goto(`/s/${A_LISTING}`);
  const terms = page.getByTestId("access-terms");
  await expect(terms).toContainText(/direct contact details for up to 5 matching operators/);
  await expect(terms).toContainText("you see exactly how many match before you pay");
  await expect(terms).toContainText("no commission or markup on the rental price");
  await expect(page.getByRole("link", { name: "Ride owner vs. rental broker →" })).toHaveAttribute("href", "/guides/ride-owner-vs-rental-broker");
  await expect(page.locator("main")).not.toContainText(/operator (that|who) owns/);
});

test("phone layouts: connect, offer, ride page and guide fit the screen", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: PHONE, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  for (const [path, name] of [["/connect", "connect"], [`/s/${A_LISTING}`, "ride"], ["/guides/ride-owner-vs-rental-broker", "guide"], ["/", "home"]] as const) {
    await page.goto(path);
    await noSideScroll(page, path);
    await page.screenshot({ path: `test-results/mobile-${name}.png`, fullPage: false });
  }
  // A real offer for a search: the per-search box with the exact number of contacts.
  await page.goto("/ohio/columbus/ferris-wheel");
  await page.locator('[data-testid="ride-result"]').first().getByRole("link", { name: "Connect with operators" }).click();
  await page.fill("#eventDate", "2030-06-15");
  await page.fill("#city", "Columbus");
  await page.selectOption("#state", "OH");
  await page.fill("#email", "buyer@example.com");
  await page.getByRole("button", { name: "See matching operators" }).click();
  await expect(page).toHaveURL(/\/connect\/[0-9a-f-]{36}$/);
  const offer = page.getByTestId("offer");
  await expect(offer).toContainText(/Includes contact details for (5 of the \d+ matching operators, chosen by you|all \d+ matching operators)/);
  await expect(page.getByTestId("offer-contacts")).toHaveText(/^for [1-5] matching Ferris wheel operator contacts?$/);
  await expect(offer).toContainText("No commission or markup on the rental price.");
  await noSideScroll(page, "/connect/[id]");
  await offer.screenshot({ path: "test-results/mobile-offer.png" });
  await ctx.close();
});

test("the Connect form asks only for the ride, city, state, date and email", async ({ page }) => {
  await page.goto("/connect");
  const form = page.getByTestId("connect-form");
  const visible = await form.locator("input:not([type=hidden]), select").evaluateAll((els) => els.map((e) => e.id));
  expect(visible).toEqual(["rideType", "city", "state", "eventDate", "email"]);
  for (const gone of ["#eventType", "#zip", "#attendance", "#budgetUsd", "#rideClass"]) await expect(page.locator(gone)).toHaveCount(0);
  await expect(page.locator("#rideType option", { hasText: "Any kiddie ride" })).toHaveAttribute("value", "class:kiddie");
  // A page that already chose the ride doesn't ask again.
  await page.goto("/connect?type=carousel");
  expect(await page.getByTestId("connect-form").locator("input:not([type=hidden]), select").evaluateAll((els) => els.map((e) => e.id))).toEqual(["city", "state", "eventDate", "email"]);
});

