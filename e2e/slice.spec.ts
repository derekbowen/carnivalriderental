import crypto from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { E2E_INTERNAL } from "../playwright.config";

function futureDate(days = 150) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

async function internal(page: Page) {
  const ctx = await page.context().browser()!.newContext({ httpCredentials: E2E_INTERNAL, baseURL: "http://localhost:3100" });
  return ctx.newPage();
}

async function createLegacyRequest(page: Page, city: string): Promise<string> {
  // The legacy managed-request store is internal tooling now (no public form); seed it through its API.
  const res = await page.request.post("/api/requests", {
    data: {
      idempotencyKey: crypto.randomUUID(),
      acknowledgedNotABooking: true,
      brief: { rideSlug: "ferris-wheel-rental", rideFlexibility: "this_ride_only", eventDateStart: futureDate(), dateFlexibility: "fixed", city, state: "TX", eventType: "festival", expectedAttendance: "not_sure", budget: "not_sure", siteSurface: "not_sure", power: "not_sure", contact: { name: "E2E Planner", email: "planner@example.com" } },
    },
  });
  const body = (await res.json()) as { ok: boolean; statusUrl?: string; error?: string; issues?: unknown };
  if (!body.ok || !body.statusUrl) throw new Error(`legacy request failed: ${JSON.stringify(body)}`);
  return body.statusUrl;
}

test("internal console is protected, and status updates reach the customer without leaking supplier data", async ({ page, request }) => {
  expect((await request.get("/internal")).status()).toBe(401);
  expect((await request.post("/internal/api/requests/00000000-0000-0000-0000-000000000000/actions", { data: {} })).status()).toBe(401);

  const statusUrl = await createLegacyRequest(page, "Statusburg");

  const team = await internal(page);
  await team.goto("/internal");
  await team.getByRole("row").filter({ hasText: "Statusburg" }).getByRole("link").click();
  await team.getByRole("button", { name: "→ Reviewing your brief" }).click();
  await expect(team.getByText("Reviewing your brief").first()).toBeVisible();
  // Pay first: nothing is sourced or sent until the customer has paid.
  await expect(team.getByTestId("pay-first-lock")).toBeVisible();
  await team.getByRole("button", { name: "→ Sourcing an operator" }).click();
  await expect(team.getByText(/Pay-first policy: cannot start sourcing/)).toBeVisible();
  await team.getByRole("button", { name: "Demo: Funds authorized (not yet collected)" }).click();
  await expect(team.getByTestId("pay-first-lock")).toHaveCount(0);
  await team.getByRole("button", { name: "→ Sourcing an operator" }).click();
  await expect(team.getByRole("button", { name: "→ Unable to source" })).toBeVisible();

  // Add a fictional supplier candidate and record internal costs.
  await team.locator("select").first().selectOption({ label: "DEMO Operator A (fictional) — verified supplier" });
  await team.getByRole("button", { name: "Add candidate" }).click();
  await expect(team.getByText("Stage for this event: candidate")).toBeVisible();
  await team.getByLabel("Supplier quote $").fill("12000");
  await team.getByRole("button", { name: "Record quote" }).click();
  await expect(team.getByText("Stage for this event: quoted")).toBeVisible();
  await expect(team.getByText("Margin before unknown costs")).toBeVisible();

  // Confirmation is impossible from here.
  await expect(team.getByRole("button", { name: "Confirm booking" })).toHaveCount(0);

  await page.goto(statusUrl);
  await expect(page.getByTestId("fulfilment-title")).toHaveText("Sourcing an operator");
  const text = await page.locator("body").innerText();
  const html = await page.content(); // includes the serialized RSC payload
  for (const s of [text, html]) {
    expect(s).not.toContain("DEMO Operator A");
    expect(s).not.toContain("12,000");
    expect(s).not.toContain("1200000");
  }
  expect(text).not.toMatch(/margin|supplier quote|transport/i);

  // A wrong token reveals nothing.
  const bad = await request.get(statusUrl.replace(/t=[^&]+/, "t=wrong"));
  expect(bad.status()).toBe(404);
});

test("SEO surfaces: canonicals, noindex, empty sitemap, valid internal links", async ({ page, request }) => {
  const origins = new Set<string>();
  for (const path of ["/rides/ferris-wheel-rental", "/texas/austin", "/texas/austin/ferris-wheel-rental", "/categories/ferris-wheels"]) {
    const res = await request.get(path);
    expect(res.status()).toBe(200);
    expect(res.headers()["x-robots-tag"]).toContain("noindex");
    await page.goto(path);
    // Canonicals use the build-time SITE_URL; every page must agree on origin and use its exact path.
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    const u = new URL(canonical!);
    expect(u.pathname).toBe(path);
    expect(u.search).toBe("");
    origins.add(u.origin);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByRole("link", { name: /Connect with operators/ }).first()).toBeVisible();
    for (const href of await page.locator('a[href^="/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")!))) {
      const target = href.split("#")[0] || "/";
      // /preview/* cards point at per-spec test-harness listings that other specs create and delete; a cached
      // hub may still show one. Those destinations are verified in category-hubs/catalog-preview while the
      // harness exists, and are never rendered in production.
      if (target.startsWith("/preview/")) continue;
      expect((await request.get(target)).status(), `link ${target} from ${path}`).toBe(200);
    }
  }
  expect(origins.size).toBe(1);
  // /texas/austin is a real-city inventory page (Census place + operator snapshot), never indexable yet.
  await page.goto("/texas/austin");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Carnival rides for your Austin event.");

  const sitemapRes = await request.get("/sitemap.xml");
  expect(sitemapRes.status()).toBe(200);
  const sitemap = await sitemapRes.text();
  expect(sitemap).toContain("<urlset");
  expect(sitemap).not.toContain("<url>");
  expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /");
  expect((await request.get("/rides/not-a-ride")).status()).toBe(404);
});

test("full managed flow: pay first → quote → customer accepts → supplier commits → payment collected → confirmed", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  const statusUrl = await createLegacyRequest(page, "Confirmton");

  const team = await internal(page);
  team.on("dialog", (d) => d.accept());
  await team.goto("/internal");
  await team.getByRole("row").filter({ hasText: "Confirmton" }).getByRole("link").click();
  await team.getByRole("button", { name: "→ Reviewing your brief" }).click();
  await team.getByRole("button", { name: "Demo: Funds authorized (not yet collected)" }).click();
  await expect(team.getByTestId("pay-first-lock")).toHaveCount(0);
  await team.getByRole("button", { name: "→ Sourcing an operator" }).click();
  await expect(team.getByRole("button", { name: "→ Unable to source" })).toBeVisible();
  await team.locator("select").first().selectOption({ label: "DEMO Operator A (fictional) — verified supplier" });
  await team.locator("select").nth(1).selectOption({ index: 1 });
  await team.getByRole("button", { name: "Add candidate" }).click();
  await team.getByLabel("Supplier quote $").fill("12000");
  await team.getByLabel("Transport $").fill("2500");
  await team.getByRole("button", { name: "Record quote" }).click();
  await expect(team.getByText("Stage for this event: quoted")).toBeVisible();
  await team.getByPlaceholder("Customer price (USD)").fill("22000");
  await team.getByPlaceholder(/Scope:/).fill("Ferris wheel with operating crew, one day. DEMO quote.");
  await team.getByRole("button", { name: "Save draft quote" }).click();

  // A draft is invisible to the customer.
  await page.goto(statusUrl);
  await expect(page.getByText("No quote yet")).toBeVisible();

  await team.getByRole("button", { name: "Send to customer" }).click();
  await expect(team.getByText("Quote — awaiting your acceptance").first()).toBeVisible();

  await page.goto(statusUrl);
  await expect(page.getByTestId("fulfilment-title")).toHaveText("Quote ready for your review");
  await expect(page.getByText("Quote — awaiting your acceptance")).toBeVisible();
  await page.getByRole("button", { name: /Accept quote/ }).click();
  await expect(page.getByTestId("fulfilment-title")).toHaveText("Quote accepted");
  await expect(page.getByText("Accepted quote · v1")).toBeVisible();

  await team.reload();
  await team.getByRole("button", { name: "Record commitment" }).click();
  await expect(team.getByText("Stage for this event: committed")).toBeVisible();

  // An authorization (the pay-first hold) is not enough to confirm.
  await team.getByRole("button", { name: "Confirm booking" }).click();
  await expect(team.getByText(/Confirmation requires payment status "payment_captured"/)).toBeVisible();

  await page.goto(statusUrl);
  await expect(page.getByTestId("fulfilment-title")).toHaveText("Operator committed");
  await expect(page.getByTestId("payment-status")).toHaveText("Funds authorized (not yet collected)");

  await team.getByRole("button", { name: "Demo: Payment collected" }).click();
  await expect(team.getByRole("button", { name: "Demo: Refunded" })).toBeVisible();
  await team.getByRole("button", { name: "Confirm booking" }).click();
  await expect(team.getByText("Booking confirmed").first()).toBeVisible();

  await page.goto(statusUrl);
  await expect(page.getByTestId("fulfilment-title")).toHaveText("Booking confirmed");
  await expect(page.getByTestId("payment-status")).toHaveText("Payment collected");
  await expect(page.getByText("Demo mode: no card details are collected")).toBeVisible();
});
