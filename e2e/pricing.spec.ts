import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { expect, test, type Page } from "@playwright/test";
import { hashToken, newToken } from "../src/lib/access/session";

/**
 * Two-tier Event Access, end to end and offline (fake Stripe, SQLite ledger, fixture operators):
 * every Ferris entry point is priced at the Ferris tier, standard stays standard, nothing the client
 * posts changes the tier, thin supply is never sold, refunds use the purchased amount, and the
 * emailed pass link opens the pass on a fresh device.
 */
const LEDGER = "data/e2e.sqlite";
// Listings come from the inventory snapshot, not hard-coded ids, so the suite survives a re-import
// (Test → Live listing ids differ).
type SnapRide = { id: string; rideType: string | null; homeState: string | null };
const SNAPSHOT = (JSON.parse(fs.readFileSync("src/lib/inventory/rides.json", "utf8")) as { rides: SnapRide[] }).rides;
const pick = (pred: (r: SnapRide) => boolean, what: string) => {
  const r = SNAPSHOT.find(pred);
  if (!r) throw new Error(`inventory snapshot has no ${what}`);
  return r.id;
};
const FERRIS_LISTING = pick((r) => r.rideType === "ferris-wheel" && r.homeState === "oh", "Ferris wheel based in Ohio");
const GIANT_LISTING = pick((r) => r.rideType === "giant-ferris-wheel", "giant Ferris wheel");
const EVENT = { eventDate: "2030-06-15", city: "Columbus", state: "OH", email: "buyer@example.com" };
const BOTH = "Event Access is $99. Ferris Wheel Event Access is $199.";
const FERRIS = "Ferris Wheel Event Access — $199";

async function fillAndSubmit(page: Page, ev = EVENT) {
  await page.fill("#eventDate", ev.eventDate);
  await page.fill("#city", ev.city);
  await page.selectOption("#state", ev.state);
  await page.fill("#email", ev.email);
  await page.getByRole("button", { name: "See matching operators" }).click();
  await expect(page).toHaveURL(/\/connect\/[0-9a-f-]{36}$/);
  return page.url().split("/").pop()!;
}
async function submit(page: Page, from: string, ev = EVENT) {
  await page.goto(from);
  return fillAndSubmit(page, ev);
}
async function expectOffer(page: Page, product: string, price: string) {
  await expect(page.getByTestId("offer-product")).toHaveText(product);
  await expect(page.getByTestId("offer-price")).toHaveText(price);
  await expect(page.getByTestId("pay-button")).toContainText(price);
}
/** A Ferris-tier request: the $199 offer when enough operators match, otherwise the "won't charge" box naming the Ferris product. Never $99. */
async function expectFerrisTier(page: Page) {
  if (await page.getByTestId("offer").count()) await expectOffer(page, "Ferris Wheel Event Access", "$199");
  else await expect(page.getByTestId("not-sellable")).toContainText("Ferris Wheel Event Access");
  await expect(page.locator("main")).not.toContainText("$99");
}
async function payAndOpenPass(page: Page) {
  await page.getByTestId("pay-button").click();
  await expect(page).toHaveURL(/\/api\/access\/dev-checkout\?cs=cs_test_fake_/);
  const cs = new URL(page.url()).searchParams.get("cs")!;
  await page.locator("#pay").click();
  await expect(page).toHaveURL(/\/pass\/[0-9a-f-]{36}$/);
  return { cs, passId: page.url().split("/").pop()! };
}
const operatorIds = async (page: Page) => (await page.getByTestId("operator-match").evaluateAll((els) => els.map((e) => e.id))).map((id) => id.replace(/^op-/, ""));

test("every Ferris entry point is priced at the Ferris tier: category hub, ride-type city page, listing, and the /connect selector", async ({ page }) => {
  // Category hub and its CTA.
  await page.goto("/categories/ferris-wheels");
  await expect(page.getByTestId("access-price").first()).toContainText(FERRIS);
  await page.goto("/connect?category=ferris-wheels");
  await expect(page.getByTestId("connect-price")).toHaveText(FERRIS);
  await fillAndSubmit(page);
  await expectOffer(page, "Ferris Wheel Event Access", "$199");

  // Ride-type city page → its first card → /connect?listing=…
  await page.goto("/ohio/columbus/ferris-wheel");
  await expect(page.getByTestId("access-price")).toContainText(FERRIS);
  await page.locator('[data-testid="ride-result"]').first().getByRole("link", { name: "Connect with operators" }).click();
  await expect(page).toHaveURL(/\/connect\?listing=/);
  await expect(page.getByTestId("connect-price")).toHaveText(FERRIS);

  // Listing page and the request it starts.
  await page.goto(`/s/${FERRIS_LISTING}`);
  await expect(page.getByTestId("access-price")).toContainText(FERRIS);
  await submit(page, `/connect?listing=${FERRIS_LISTING}`);
  await expectOffer(page, "Ferris Wheel Event Access", "$199");

  // Selector on /connect: the note follows the choice; the server prices what is submitted.
  await page.goto("/connect");
  await expect(page.getByTestId("connect-price")).toHaveText("Event Access — $99");
  const note = page.getByTestId("price-note");
  await expect(note).toHaveAttribute("data-tier", "standard");
  await expect(note).toContainText(BOTH);
  await page.selectOption("#rideType", "ferris-wheel");
  await expect(note).toHaveAttribute("data-tier", "ferris");
  await expect(note).toContainText("Ferris Wheel Event Access — $199 applies to this request");
  await fillAndSubmit(page);
  await expectOffer(page, "Ferris Wheel Event Access", "$199");
  await expect(page.locator("main")).not.toContainText("$99");
});

test("giant and mini variants are $199; fewer than 3 qualifying operators prevents checkout at either tier", async ({ page, request }) => {
  await submit(page, "/connect?type=mini-ferris-wheel");
  await expectFerrisTier(page);
  await submit(page, "/connect?type=giant-ferris-wheel");
  await expectFerrisTier(page);
  await submit(page, `/connect?listing=${GIANT_LISTING}`);
  await expectFerrisTier(page);

  // No inventory within 200 miles of Anchorage: priced at the Ferris tier, but never for sale.
  const thin = await submit(page, "/connect?type=giant-ferris-wheel", { ...EVENT, city: "Anchorage", state: "AK" });
  await expect(page.getByTestId("match-heading")).toContainText("No direct operator matches yet");
  await expect(page.getByTestId("not-sellable")).toContainText("Ferris Wheel Event Access with at least 3");
  expect(await page.getByTestId("pay-button").count()).toBe(0);
  const forced = await request.post("/api/access/checkout", { form: { event: thin }, maxRedirects: 0 });
  expect(forced.headers()["location"]).toContain("error=not_sellable");
});

test("standard requests stay $99 (even when matched operators own Ferris wheels), and general pages state both tiers", async ({ page }) => {
  await submit(page, "/connect?type=carousel");
  await expectOffer(page, "Event Access", "$99");
  await page.goto("/connect");
  await page.selectOption("#rideType", "class:kiddie");
  await fillAndSubmit(page);
  await expectOffer(page, "Event Access", "$99");
  await expect(page.locator("main")).not.toContainText("$199");

  await page.goto("/");
  await expect(page.getByTestId("home-price")).toHaveText(BOTH);
  await page.goto("/categories/carousels");
  await expect(page.getByTestId("access-price").first()).toContainText(BOTH);
  await page.goto("/ohio/columbus");
  await expect(page.getByTestId("access-price")).toContainText(BOTH);
  await page.goto("/access-policy");
  await expect(page.getByTestId("policy-prices")).toContainText(BOTH);
  await page.goto("/texas");
  await expect(page.getByTestId("pricing-notice")).toContainText(BOTH);
});

test("tampering: posted price/product fields and a false ride type cannot buy a Ferris pass for $99; a standard pass is never converted", async ({ page, request, context }) => {
  // A Ferris listing with a claimed carousel type, a $99 price and the standard product id posted directly to the API.
  const start = await request.post("/api/access/start", { form: { ...EVENT, listingId: FERRIS_LISTING, rideType: "carousel", rideClass: "kiddie", priceCents: "9900", productId: "prod_event_access_v1", product: "event-access", amount: "99", tier: "standard" }, maxRedirects: 0 });
  expect(start.status()).toBe(303);
  const matches = start.headers()["location"]!;
  expect(matches).toMatch(/^\/connect\/[0-9a-f-]{36}$/);
  await page.goto(matches);
  await expectOffer(page, "Ferris Wheel Event Access", "$199");
  const id = matches.split("/").pop()!;
  const co = await request.post("/api/access/checkout", { form: { event: id, amount: "9900", price: "99", product: "event-access", productId: "prod_event_access_v1" }, maxRedirects: 0 });
  expect(co.status()).toBe(303);
  const checkout = co.headers()["location"]!;
  expect(checkout).toMatch(/^\/api\/access\/dev-checkout\?cs=cs_test_fake_/);
  await page.goto(checkout);
  await expect(page.locator("#line-item")).toContainText("Ferris Wheel Event Access");
  await expect(page.locator("#amount")).toHaveText("199.00 USD");
  await page.locator("#pay").click();
  await expect(page).toHaveURL(/\/pass\//);
  await expect(page.getByTestId("pass-product")).toContainText("Ferris Wheel Event Access · $199 paid");

  // A standard pass is bound to its own request: a later Ferris request is separate, and the pass
  // can't unlock an operator that only the Ferris request matched.
  await submit(page, "/connect?type=kiddie-jets");
  await expectOffer(page, "Event Access", "$99");
  const { passId } = await payAndOpenPass(page);
  await expect(page.getByTestId("pass-product")).toContainText("Event Access · $99 paid");
  const standardOps = await operatorIds(page);
  await submit(page, "/connect?type=ferris-wheel", { ...EVENT, email: "other@example.com" });
  const ferrisOnly = (await operatorIds(page)).find((o) => !standardOps.includes(o))!;
  expect(ferrisOnly).toBeTruthy();
  const cookie = (await context.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  const refused = await request.post(`/api/pass/${passId}/unlock`, { form: { operator: ferrisOnly }, headers: { cookie }, maxRedirects: 0 });
  expect(refused.headers()["location"]).toContain("error=forbidden");
  await page.goto(`/pass/${passId}`);
  await expect(page.getByTestId("pass-status")).toContainText("0 of 5 unlocked");
  await expect(page.getByTestId("pass-product")).toContainText("Event Access · $99 paid");
});

test("refunds use the purchased amount: $99 back on a $199 pass is partial, $199 revokes; duplicate notifications change nothing", async ({ page, request }) => {
  await submit(page, "/connect?type=ferris-wheel");
  await expectOffer(page, "Ferris Wheel Event Access", "$199");
  const { cs } = await payAndOpenPass(page);
  const pi = `pi_fake_${cs.slice(-8)}`;
  const hook = (id: string, data: Record<string, unknown>) => request.post("/api/access/webhook", { headers: { "stripe-signature": "fake", "content-type": "application/json" }, data: { id, ...data } });
  const refund = (id: string, amount_refunded: number) => hook(id, { type: "charge.refunded", data: { object: { object: "charge", amount: 19900, amount_refunded, payment_intent: pi } } });

  // A second "payment completed" for the same session creates no second entitlement.
  expect(await (await hook(`evt_again_${cs}`, { type: "checkout.session.completed", data: { object: { id: cs, object: "checkout.session", payment_status: "paid", status: "complete", payment_intent: pi } } })).json()).toMatchObject({ result: "already active" });
  const db = new DatabaseSync(LEDGER);
  expect((db.prepare(`SELECT COUNT(*) AS n FROM access_passes p JOIN access_purchases pu ON pu.id = p.purchase_id WHERE pu.stripe_checkout_session_id = ?`).get(cs) as { n: number }).n).toBe(1);
  db.close();

  expect(await (await refund(`evt_part_${cs}`, 9900)).json()).toMatchObject({ result: "partial refund" });
  await page.reload();
  await expect(page.getByTestId("pass-status")).toContainText("Active");
  expect(await (await refund(`evt_full_${cs}`, 19900)).json()).toMatchObject({ result: "refunded, pass revoked" });
  expect(await (await refund(`evt_full_${cs}`, 19900)).json()).toMatchObject({ result: "duplicate" });
  await page.reload();
  await expect(page.getByTestId("pass-status")).toContainText("Revoked");
});

test("the emailed pass link opens the pass in a fresh browser; re-opening an unlocked operator consumes no unlock", async ({ page, browser, request }) => {
  await submit(page, "/connect?type=carousel");
  const { passId } = await payAndOpenPass(page);
  await page.getByTestId("operator-match").first().getByRole("button", { name: "Unlock operator contact" }).click();
  await expect(page.getByTestId("pass-status")).toContainText("1 of 5 unlocked");

  // The email carries /pass/open?t=<token>; the ledger stores only the token's hash. Issue one exactly as the service does.
  const token = newToken();
  const db = new DatabaseSync(LEDGER);
  db.prepare(`INSERT INTO access_magic_links (token_hash, pass_id, expires_at, created_at) VALUES (?, ?, ?, ?)`).run(hashToken(token), passId, new Date(Date.now() + 864e5).toISOString(), new Date().toISOString());
  db.close();

  const fresh = await browser.newContext();
  const device = await fresh.newPage();
  await device.goto(`/pass/open?t=${token}`);
  await expect(device).toHaveURL(new RegExp(`/pass/${passId}$`));
  await expect(device.getByTestId("pass-status")).toContainText("1 of 5 unlocked");
  const unlocked = device.locator('[data-testid="operator-match"][data-unlocked="1"]');
  await expect(unlocked).toHaveCount(1);
  await expect(unlocked.first()).toContainText(/Fixture Amusements/);
  expect(await unlocked.first().getByTestId("revealed-contact").locator('a[href^="tel:"], a[href^="mailto:"], a[href^="https://"]').count()).toBeGreaterThan(0);
  // Re-opening the same operator from the new device is free.
  const op = (await unlocked.first().getAttribute("id"))!.replace(/^op-/, "");
  const again = await device.request.post(`/api/pass/${passId}/unlock`, { form: { operator: op }, maxRedirects: 0 });
  expect(again.status()).toBe(303);
  await device.reload();
  await expect(device.getByTestId("pass-status")).toContainText("1 of 5 unlocked");
  await fresh.close();

  // A token nobody issued opens nothing.
  const bad = await request.get(`/pass/open?t=${newToken()}`, { maxRedirects: 0 });
  expect(bad.headers()["location"]).toContain("/pass/recover?invalid=1");
});

test("requote: a Ferris request stored at the old standard product shows and charges $199, and the stale $99 quote is expired", async ({ page }) => {
  const id = await submit(page, "/connect?type=ferris-wheel");
  await page.getByTestId("pay-button").click(); // a $199 pending checkout exists; now simulate the pre-change state
  await expect(page).toHaveURL(/\/api\/access\/dev-checkout\?cs=/);
  const cs = new URL(page.url()).searchParams.get("cs")!;
  const db = new DatabaseSync(LEDGER);
  db.prepare(`UPDATE access_event_requests SET product_id = 'prod_event_access_v1' WHERE id = ?`).run(id);
  db.prepare(`UPDATE access_purchases SET product_id = 'prod_event_access_v1', amount_cents = 9900 WHERE stripe_checkout_session_id = ?`).run(cs);
  db.close();

  await page.goto(`/connect/${id}`);
  await expect(page.getByTestId("requoted")).toContainText("Ferris Wheel Event Access at $199");
  await expectOffer(page, "Ferris Wheel Event Access", "$199");
  const paid = await payAndOpenPass(page);
  await expect(page.getByTestId("pass-product")).toContainText("Ferris Wheel Event Access · $199 paid");

  const after = new DatabaseSync(LEDGER);
  expect((after.prepare(`SELECT product_id FROM access_event_requests WHERE id = ?`).get(id) as { product_id: string }).product_id).toBe("prod_ferris_wheel_access_v1");
  expect(after.prepare(`SELECT status, amount_cents FROM access_purchases WHERE stripe_checkout_session_id = ?`).get(cs)).toEqual({ status: "expired", amount_cents: 9900 });
  expect(after.prepare(`SELECT status, amount_cents, product_id FROM access_purchases WHERE stripe_checkout_session_id = ?`).get(paid.cs)).toEqual({ status: "paid", amount_cents: 19900, product_id: "prod_ferris_wheel_access_v1" });
  after.close();
  // The stale $99 session can no longer be paid.
  await page.goto(`/api/access/dev-checkout?cs=${cs}&outcome=paid`);
  await expect(page).not.toHaveURL(/\/pass\/[0-9a-f-]{36}$/);
});
