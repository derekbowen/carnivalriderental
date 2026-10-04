import { expect, test } from "@playwright/test";
import { E2E_INTERNAL } from "../playwright.config";

test("operator page: early access, 0% operator commission, fee not invented, noindex", async ({ page, request }) => {
  const res = await request.get("/operators");
  expect(res.status()).toBe(200);
  expect(res.headers()["x-robots-tag"]).toContain("noindex");
  await page.goto("/operators");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Rent out your carnival rides. Keep 100% of your price.");
  await expect(page.getByTestId("early-access")).toContainText("isn’t live yet");
  await expect(page.getByTestId("fee-pending")).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  // No service-fee rate is invented: the only percentages are the 0% commission and "keep 100%".
  const pcts = (await page.locator("main").innerText()).match(/\d+(\.\d+)?%/g) ?? [];
  expect(new Set(pcts)).toEqual(new Set(["0%", "100%"]));
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "For ride operators" })).toHaveAttribute("href", "/operators");
});

test("operator applies; the team sees it in the console; nothing else is created", async ({ page, browser }) => {
  await page.goto("/operators");
  await page.getByRole("button", { name: "Apply for early access" }).click();
  await expect(page.getByText("Please check the highlighted fields.")).toBeVisible();

  await page.getByLabel("Company name").fill("E2E Example Amusements");
  await page.getByLabel("Your name").fill("Pat Example");
  await page.getByLabel("Email", { exact: true }).fill("pat@example.test");
  await page.getByLabel("Mobile phone").fill("555-010-0000");
  await page.getByLabel("Home base state").selectOption("tx");
  await page.getByLabel("States you serve (optional)").fill("TX, OK");
  await page.getByLabel("Your rides").fill("1 Ferris wheel, 2 kiddie rides");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Apply for early access" }).click();
  await expect(page.getByTestId("application-received")).toContainText("no listing has been created");

  const ctx = await browser.newContext({ httpCredentials: E2E_INTERNAL });
  const internal = await ctx.newPage();
  await internal.goto("/internal/operators");
  const row = internal.getByRole("row", { name: /E2E Example Amusements/ });
  await expect(row).toContainText("pat@example.test");
  await expect(row).toContainText("tx, ok");
  await ctx.close();
});
