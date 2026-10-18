import { expect, test } from "@playwright/test";
import { E2E_INTERNAL } from "../playwright.config";

/**
 * The internal Leads list: behind the console login, never cached or indexed, shows a real search
 * with the customer's own details and a reply link, and never operator identity or contact data.
 */
const FIXTURE_CONTACT = /Fixture Amusements|555 010 00|example\.test|Pat Fixture/;

test("leads: login required; a search shows with its event, outcome and reply link; no operator data", async ({ page, browser }) => {
  const anon = await page.request.get("/internal/leads");
  expect(anon.status()).toBe(401);

  // A customer search from the ride-type city page, tagged as a Google ad click.
  await page.goto("/ohio/columbus/ferris-wheel?utm_source=google&utm_medium=cpc&utm_campaign=crr-search");
  await page.locator('[data-testid="ride-result"]').first().getByRole("link", { name: "Connect with operators" }).click();
  await page.fill("#eventDate", "2030-06-15");
  await page.fill("#city", "Columbus");
  await page.selectOption("#state", "OH");
  await page.fill("#email", "e2e-lead@fastmail.com");
  await page.getByRole("button", { name: "See matching operators" }).click();
  await expect(page).toHaveURL(/\/connect\/[0-9a-f-]{36}$/);

  const ctx = await browser.newContext({ httpCredentials: E2E_INTERNAL, baseURL: "http://localhost:3100" });
  const team = await ctx.newPage();
  const res = await team.goto("/internal/leads");
  expect(res!.headers()["cache-control"]).toContain("no-store");
  expect(res!.headers()["x-robots-tag"]).toContain("noindex");
  const row = team.getByTestId("lead").filter({ hasText: "e2e-lead@fastmail.com" }).first();
  await expect(row).toBeVisible();
  await expect(row).toContainText("Columbus, OH");
  await expect(row).toContainText("Ferris wheel");
  await expect(row).toContainText("google / cpc / crr-search");
  await expect(row).toContainText("Didn't buy");
  await expect(row.getByRole("link", { name: "e2e-lead@fastmail.com" })).toHaveAttribute("href", /^mailto:e2e-lead@fastmail\.com\?subject=/);
  expect(await team.content()).not.toMatch(FIXTURE_CONTACT);
  // The console's status pills describe the real Event Access setup (here the local fake), and tap open.
  const pills = team.getByTestId("integration-status");
  await expect(pills.filter({ hasText: "Payments:" })).toContainText("fake checkout (local only)");
  await expect(pills.filter({ hasText: "Email:" })).toBeVisible();
  await expect(team.locator("body")).not.toContainText("demo adapter (not connected)");
  await pills.filter({ hasText: "Payments:" }).locator("summary").click();
  await expect(pills.filter({ hasText: "Payments:" })).toContainText("No money moves");
  // The console nav reaches it.
  await team.goto("/internal/funnel");
  await team.getByRole("navigation", { name: "Console" }).getByRole("link", { name: "Leads" }).click();
  await expect(team).toHaveURL(/\/internal\/leads$/);
  await ctx.close();
});
