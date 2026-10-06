import { expect, test, type Page } from "@playwright/test";

/**
 * Event Access end to end, offline: fake Stripe gateway (no key), SQLite ledger, fictional operators
 * (ACCESS_OPERATOR_SOURCE=fixture). Covers Find → Evaluate → Connect → pay → unlock → contact, the
 * entitlement boundary, refund revocation and the privacy of anonymous surfaces.
 */
const FIXTURE_CONTACT = /Fixture Amusements|555 010 00|example\.test|Pat Fixture/;

async function startRequest(page: Page, from: string) {
  await page.goto(from);
  // The card's CTA (the header has a generic "Connect with operators" link without listing context).
  await page.locator('[data-testid="ride-result"]').first().getByRole("link", { name: "Connect with operators" }).click();
  await expect(page).toHaveURL(/\/connect\?listing=/);
  await expect(page.getByTestId("connect-context")).toBeVisible();
  await page.fill("#eventDate", "2030-06-15");
  await page.fill("#city", "Columbus");
  await page.selectOption("#state", "OH");
  await page.fill("#email", "buyer@example.com");
  await page.getByRole("button", { name: "See matching operators" }).click();
  await expect(page).toHaveURL(/\/connect\/[0-9a-f-]{36}$/);
}

test("find → evaluate → connect: honest match count, server-side price, no contact before payment", async ({ page, request }) => {
  await startRequest(page, "/ohio/columbus/ferris-wheel");
  const heading = await page.getByTestId("match-heading").innerText();
  const n = Number(/^(\d+) direct operator match/.exec(heading)?.[1]);
  expect(n).toBeGreaterThanOrEqual(3);
  const cards = page.getByTestId("operator-match");
  expect(await cards.count()).toBe(n);
  await expect(page.getByTestId("offer-price")).toHaveText("$99");
  await expect(page.getByTestId("offer")).toContainText(`Unlocks up to 5 of these ${n} operators`);
  // Nothing identifying before payment: not in the HTML, not in JSON-LD.
  const html = await (await request.get(page.url())).text();
  expect(html).not.toMatch(FIXTURE_CONTACT);
  expect(html).toMatch(/"@type":"Offer"/);
  expect(html).not.toMatch(/tel:|mailto:(?!support@|claims@|hello@)/);
  const headers = (await request.get(page.url())).headers();
  expect(headers["cache-control"]).toContain("no-store");
  expect(headers["x-robots-tag"]).toContain("noindex");
});

test("pay → pass → unlock → contact; re-open is free; limit enforced; entitlement boundary", async ({ page, request, context }) => {
  await startRequest(page, "/ohio/columbus");
  await page.getByTestId("pay-button").click();
  await expect(page).toHaveURL(/\/api\/access\/dev-checkout\?cs=cs_test_fake_/);
  await page.locator("#pay").click();
  await expect(page).toHaveURL(/\/pass\/[0-9a-f-]{36}$/);
  const passUrl = page.url();
  const passId = passUrl.split("/").pop()!;
  await expect(page.getByTestId("pass-status")).toContainText("0 of 5 unlocked");
  const ops = page.getByTestId("operator-match");
  const total = await ops.count();
  expect(total).toBeGreaterThanOrEqual(5);
  await expect(page.locator('[data-testid="revealed-contact"]')).toHaveCount(0);

  // Unlock the first operator: contact appears, counter moves.
  await ops.nth(0).getByRole("button", { name: "Unlock operator contact" }).click();
  await expect(page.getByTestId("pass-status")).toContainText("1 of 5 unlocked");
  const revealed = page.locator('[data-testid="operator-match"][data-unlocked="1"]');
  await expect(revealed).toHaveCount(1);
  await expect(revealed.first().getByTestId("revealed-contact")).toContainText(/Fixture|555|example\.test/);
  const firstOp = await revealed.first().getAttribute("id");

  // Posting the same operator again does not consume another unlock.
  const cookie = (await context.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  const again = await request.post(`/api/pass/${passId}/unlock`, { form: { operator: firstOp!.replace(/^op-/, "") }, headers: { cookie }, maxRedirects: 0 });
  expect(again.status()).toBe(303);
  await page.reload();
  await expect(page.getByTestId("pass-status")).toContainText("1 of 5 unlocked");

  // Use the remaining four, then the sixth is refused.
  for (let i = 1; i <= 4; i++) {
    await page.locator('[data-testid="operator-match"][data-unlocked="0"]').first().getByRole("button", { name: "Unlock operator contact" }).click();
    await expect(page.getByTestId("pass-status")).toContainText(`${i + 1} of 5 unlocked`);
  }
  await expect(page.getByTestId("pass-status")).toContainText("0 remaining");
  if (total > 5) {
    const sixth = await page.locator('[data-testid="operator-match"][data-unlocked="0"]').first().getAttribute("id");
    const refused = await request.post(`/api/pass/${passId}/unlock`, { form: { operator: sixth!.replace(/^op-/, "") }, headers: { cookie }, maxRedirects: 0 });
    expect(refused.headers()["location"]).toContain("error=limit");
    await page.reload();
    await expect(page.locator('[data-testid="operator-match"][data-unlocked="1"]')).toHaveCount(5);
  }

  // Entitlement boundary: no cookie → 403 on unlock and a locked pass page; wrong pass id → 404.
  expect((await request.post(`/api/pass/${passId}/unlock`, { form: { operator: "op-fixture-oh-0" }, maxRedirects: 0 })).status()).toBe(403);
  const anon = await request.get(passUrl);
  expect(await anon.text()).toContain("Open your pass from your email");
  expect(await anon.text()).not.toMatch(FIXTURE_CONTACT);
  // An unknown pass id without a cookie gets the same locked page (no enumeration of which passes exist).
  const unknown = await request.get("/pass/00000000-0000-4000-8000-000000000000");
  expect(unknown.status()).toBe(200);
  expect(await unknown.text()).toContain("Open your pass from your email");

});

test("refund revokes the pass and blocks new unlocks (webhook by purchase lookup)", async ({ page, request }) => {
  await startRequest(page, "/ohio/columbus");
  await page.getByTestId("pay-button").click();
  const cs = new URL(page.url()).searchParams.get("cs")!;
  await page.locator("#pay").click();
  await expect(page).toHaveURL(/\/pass\//);
  const passId = page.url().split("/").pop()!;
  const r = await request.post("/api/access/webhook", { headers: { "stripe-signature": "fake", "content-type": "application/json" }, data: { id: `evt_refund_${cs}`, type: "charge.refunded", data: { object: { object: "charge", amount: 9900, amount_refunded: 9900, payment_intent: `pi_fake_${cs.slice(-8)}` } } } });
  expect(await r.json()).toMatchObject({ result: "refunded, pass revoked" });
  const dup = await request.post("/api/access/webhook", { headers: { "stripe-signature": "fake", "content-type": "application/json" }, data: { id: `evt_refund_${cs}`, type: "charge.refunded", data: { object: {} } } });
  expect(await dup.json()).toMatchObject({ result: "duplicate" });
  await page.reload();
  await expect(page.getByTestId("pass-status")).toContainText("Revoked");
  await expect(page.getByRole("button", { name: "Unlock operator contact" }).first()).toBeDisabled();
  expect((await request.post("/api/access/webhook", { headers: { "content-type": "application/json" }, data: { id: "x", type: "y", data: { object: {} } } })).status()).toBe(400);
  expect(passId).toMatch(/^[0-9a-f-]{36}$/);
});

test("cancelled or expired checkout never creates a pass; weak inventory is not sold", async ({ page, request }) => {
  await startRequest(page, "/ohio/columbus");
  await page.getByTestId("pay-button").click();
  await page.locator("#cancel").click();
  await expect(page).toHaveURL(/\/connect\/[0-9a-f-]{36}\?cancelled=1/);
  await expect(page.getByText("Checkout was cancelled. Nothing was charged.")).toBeVisible();
  await page.getByTestId("pay-button").click();
  await page.locator("#expire").click();
  await expect(page).toHaveURL(/cancelled=1/);
  // A region with no inventory: honest zero, no offer.
  await page.goto("/connect?type=ferris-wheel");
  await page.fill("#eventDate", "2030-06-15");
  await page.fill("#city", "Anchorage");
  await page.selectOption("#state", "AK");
  await page.fill("#email", "buyer@example.com");
  await page.getByRole("button", { name: "See matching operators" }).click();
  await expect(page.getByTestId("match-heading")).toContainText("No direct operator matches yet");
  await expect(page.getByTestId("not-sellable")).toBeVisible();
  expect(await page.getByTestId("pay-button").count()).toBe(0);
  expect((await request.get("/request?listing=6ac25d13-69ba-4a14-9d1d-6c5ef96615c4", { maxRedirects: 0 })).headers()["location"]).toBe("/connect?listing=6ac25d13-69ba-4a14-9d1d-6c5ef96615c4");
});

test("public surfaces never carry operator contact data or payment copy from the old model", async ({ request }) => {
  for (const path of ["/", "/s", "/ohio/columbus", "/ohio/columbus/ferris-wheel", "/s/6ac25d13-69ba-4a14-9d1d-6c5ef96615c4", "/directory/ohio", "/rides", "/operators"]) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
    const html = await res.text();
    expect(html, path).not.toMatch(FIXTURE_CONTACT);
    expect(html, path).not.toMatch(/mailto:(?!support@|claims@|hello@|notifications@)/);
    expect(html, path).not.toMatch(/Book this ride|Stripe Connect|connect payouts|Request this ride|request desk|marketplace inbox|Start an event request/i);
  }
  const robots = await (await request.get("/robots.txt")).text();
  // Indexing is off, so robots.txt is the blanket Disallow; when it opens, /pass and /connect stay disallowed.
  expect(robots).toMatch(/Disallow: \/(\s|$)|Disallow: \/pass/);
});
