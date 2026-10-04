// End-to-end check of the session-one slice against a production build.
// Starts `next start` on a throwaway database, drives Chromium through the
// customer and internal flows, and checks the acceptance criteria.
//
//   npm run build && npm run test:e2e
//
// Uses the Playwright install from PLAYWRIGHT_PATH (or the global one).
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "/opt/node22/lib/node_modules/playwright");

const PORT = 3123;
const BASE = `http://127.0.0.1:${PORT}`;
const USER = "team";
const PASS = "dev-only-password-1234";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bac-e2e-"));
const env = {
  ...process.env,
  NODE_ENV: "production",
  SITE_URL: "https://bookacarnival.example",
  SITE_INDEXING: "off",
  SHOW_FIXTURES: "on",
  INTERNAL_USER: USER,
  INTERNAL_PASSWORD: PASS,
  DATABASE_PATH: path.join(dir, "e2e.sqlite"),
  REQUEST_TOKEN_SECRET: "e2e-secret-e2e-secret-e2e-secret-000",
};

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : ` — ${detail}`}`);
  if (!ok) failures++;
};
const auth = "Basic " + Buffer.from(`${USER}:${PASS}`).toString("base64");

const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(PORT)], {
  env,
  stdio: ["ignore", "pipe", "pipe"],
  detached: true, // own process group, so the next-server child is stopped too
});
const stopServer = () => {
  try { process.kill(-server.pid, "SIGKILL"); } catch {}
};
let log = "";
server.stdout.on("data", (d) => (log += d));
server.stderr.on("data", (d) => (log += d));

async function waitUp() {
  const busy = await fetch(BASE + "/").then(() => true, () => false);
  if (busy) throw new Error(`Port ${PORT} is already in use — stop the other server first.`);
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(BASE + "/")).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("server did not start:\n" + log);
}

const future = new Date(Date.now() + 150 * 86400_000).toISOString().slice(0, 10);

try {
  await waitUp();

  // ── Indexing safeguards and canonicals ──
  const home = await fetch(BASE + "/");
  check("every response is noindex (X-Robots-Tag)", /noindex/.test(home.headers.get("x-robots-tag") || ""));
  const robots = await (await fetch(BASE + "/robots.txt")).text();
  check("robots.txt disallows all while indexing is off", /Disallow: \//.test(robots));
  const sitemap = await (await fetch(BASE + "/sitemap.xml")).text();
  check("sitemap is empty while indexing is off (no fixtures)", !/<loc>/.test(sitemap));

  const canon = async (p) => {
    const html = await (await fetch(BASE + p)).text();
    return html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  };
  const families = {
    "/rides": "https://bookacarnival.example/rides",
    "/rides/category/ferris-wheels": "https://bookacarnival.example/rides/category/ferris-wheels",
    "/rides/ferris-wheel-rental": "https://bookacarnival.example/rides/ferris-wheel-rental",
    "/locations/tx/austin": "https://bookacarnival.example/locations/tx/austin",
    "/locations/tx/austin/ferris-wheel-rental": "https://bookacarnival.example/locations/tx/austin/ferris-wheel-rental",
    "/rides?category=carousels": "https://bookacarnival.example/rides",
  };
  for (const [p, want] of Object.entries(families)) check(`canonical for ${p}`, (await canon(p)) === want, String(await canon(p)));
  const noindexMeta = await (await fetch(BASE + "/rides/ferris-wheel-rental")).text();
  check("fixture ride page has robots noindex meta", /<meta name="robots" content="noindex, nofollow"/.test(noindexMeta));
  check("fixture ride page shows the development-data banner", /Development data\./.test(noindexMeta));
  check("ride page labels the placeholder estimate", /Placeholder estimate \(development data\)/.test(noindexMeta));
  check("unlisted ride + city pair is 404", (await fetch(BASE + "/locations/oh/columbus/ferris-wheel-rental")).status === 404);
  check("uppercase URL variant is 404 (one canonical form)", (await fetch(BASE + "/rides/Ferris-Wheel-Rental")).status === 404);

  // ── Internal area is closed without credentials ──
  check("internal page requires auth", (await fetch(BASE + "/internal")).status === 401);
  check("internal API requires auth", (await fetch(BASE + "/api/internal/requests")).status === 401);

  // ── Customer journey in a browser ──
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  await page.goto(BASE + "/rides/ferris-wheel-rental");
  await page.getByRole("link", { name: "Request this ride" }).click();
  await page.waitForURL(/\/request\?ride=ferris-wheel-rental/);

  const select = (label, value) => page.getByLabel(label).selectOption(value);
  await page.getByRole("button", { name: "Continue" }).click(); // step 1 → 2
  await page.getByLabel("Event date (or first day)").fill(future);
  await select("Date flexibility", "fixed");
  await select("Event type", "festival");
  await page.getByLabel("City").fill("Austin");
  await page.getByLabel("State").fill("tx");
  await select("Expected attendance", "2000_10000");
  await page.getByRole("button", { name: "Continue" }).click();
  await select("Site access for trucks", "not_sure");
  await select("Space available for the ride", "not_sure");
  await select("Power", "not_sure");
  await select("Budget", "10k_25k");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Your name").fill("E2E Customer");
  await page.getByLabel("Email").fill("e2e@example.com");
  await page.getByRole("button", { name: "Continue" }).click();
  check("review screen shows the brief", await page.getByText("Review your request").isVisible());

  // Storage failure: the browser must not show success.
  await page.route("**/api/requests", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "not_saved", message: "Your request was not saved. Please try again." }) }),
  );
  await page.getByRole("button", { name: "Submit request" }).click();
  const failAlert = page.getByRole("alert").filter({ hasText: "not saved" });
  await failAlert.waitFor();
  check("a failed save shows an error and no confirmation", (await failAlert.isVisible()) && !page.url().includes("/requests/"));
  await page.unroute("**/api/requests");

  // Real submission.
  await page.getByRole("button", { name: "Submit request" }).click();
  await page.waitForURL(/\/requests\/BAC-[A-Z0-9]{6}\?t=.+&submitted=1/);
  check("confirmation says it is not a booking", await page.getByText("Request received — this is not a booking yet").isVisible());
  const statusUrl = page.url().replace("&submitted=1", "");
  const reference = statusUrl.match(/BAC-[A-Z0-9]{6}/)[0];
  await page.goto(statusUrl);
  await page.reload();
  check("request survives reload", (await page.locator("h1").innerText()).includes("Request received"));

  // Duplicate submission with the same key.
  const key = crypto.randomUUID();
  const brief = {
    idempotencyKey: key, rideSlug: "carousel-rental", rideFlexibility: "similar_rides_ok", dateStart: future,
    dateFlexibility: "fixed", city: "Columbus", state: "OH", eventType: "municipal", expectedAttendance: "not_sure",
    budget: "not_sure", siteAccess: "not_sure", availableSpace: "not_sure", power: "not_sure",
    contactName: "Dup Test", contactEmail: "dup@example.com",
  };
  const post = () => fetch(BASE + "/api/requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(brief) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  const [d1, d2] = await Promise.all([post(), post()]);
  const d3 = await post();
  check("repeated submission returns the same request", d1.body.reference && d1.body.reference === d2.body.reference && d2.body.reference === d3.body.reference, JSON.stringify([d1, d2, d3]));
  const list = await (await fetch(BASE + "/api/internal/requests", { headers: { authorization: auth } })).json();
  check("no duplicate rows were created", list.requests.length === 2, `got ${list.requests.length}: ${JSON.stringify(list.requests.map((r) => [r.reference, r.city, r.contact_email, r.created_at]))}`);
  const requestId = list.requests.find((r) => r.reference === reference).id;

  // ── Internal team flow ──
  const ctx = await browser.newContext({ httpCredentials: { username: USER, password: PASS } });
  const team = await ctx.newPage();
  team.on("pageerror", (e) => pageErrors.push(e.message));
  await team.goto(BASE + "/internal");
  check("internal queue lists the request", await team.getByRole("link", { name: reference }).isVisible());
  await team.getByRole("link", { name: reference }).click();
  await team.waitForURL(/\/internal\/requests\//);

  const statusForm = team.locator("form").filter({ has: team.getByRole("button", { name: "Update status" }) });
  await statusForm.locator("select[name=to]").selectOption("sourcing");
  await statusForm.getByRole("button", { name: "Update status" }).click();
  await team.getByText("Status updated.").waitFor();

  await team.getByPlaceholder("…or new supplier business name").fill("Example Amusements (fixture)");
  await team.getByRole("button", { name: "Add to this request" }).click();
  await team.getByText("Supplier added.").waitFor();

  // Commit before verification must be refused.
  const stage = team.getByLabel("Stage for this event");
  await stage.selectOption("committed");
  await stage.locator("xpath=..").getByRole("button", { name: "Set" }).click();
  await team.getByText(/Only a verified supplier|Record the supplier's quote/).waitFor();
  check("an unverified supplier cannot be committed", true);

  await team.getByText("Record a supplier quote (new version)").click();
  await team.getByPlaceholder("Supplier quote $").fill("12000");
  await team.getByPlaceholder("Transport $ (blank = unknown)").fill("1500");
  await team.getByRole("button", { name: "Save supplier quote" }).click();
  await team.getByText("Supplier quote recorded.").waitFor();

  const sstat = team.getByLabel("Supplier status");
  await sstat.selectOption("verified");
  await sstat.locator("xpath=..").getByRole("button", { name: "Set" }).click();
  await team.getByText("Supplier status updated.").waitFor();
  await team.getByLabel("Stage for this event").selectOption("committed");
  await team.getByLabel("Stage for this event").locator("xpath=..").getByRole("button", { name: "Set" }).click();
  await team.getByText("Stage updated.").waitFor();

  await team.getByPlaceholder("Customer price $").fill("22000");
  await team.getByPlaceholder(/Scope the customer is accepting/).fill("Ferris wheel with operating crew, 10am–8pm, transport, setup and teardown.");
  await team.getByRole("button", { name: "Send quote" }).click();
  await team.getByText("Quote sent to the customer.").waitFor();
  const detail = await team.content();
  check("internal view shows projected contribution with unknowns", /Projected contribution \(not guaranteed\)/.test(detail) && /Excludes unknown:/.test(detail));

  // Customer sees the quote, but no supplier data.
  const pub = await (await fetch(`${BASE}/api/requests/${reference}?t=${new URL(statusUrl).searchParams.get("t")}`)).text();
  check("public API exposes no supplier, cost or margin data", !/Example Amusements|supplier|1200000|150000|contribution|next_action/i.test(pub), pub);
  await page.goto(statusUrl);
  const custHtml = await page.content();
  const custText = await page.locator("body").innerText();
  check("customer sees the quote labelled as awaiting acceptance", /Quote sent — awaiting your acceptance/.test(custHtml));
  check(
    "customer page has no supplier names or costs",
    !/Example Amusements|\$12,000|\$1,500|contribution|supplier/i.test(custText) && !/Example Amusements|1200000|150000/.test(custHtml),
  );

  await page.getByLabel(/I accept this scope and price/).check();
  await page.getByRole("button", { name: "Accept quote" }).click();
  await page.getByText("Accepted quote").waitFor();
  check("accepted quote is labelled as accepted", await page.getByText("Accepted quote").isVisible());

  // Internal: commit supplier, then confirmation is refused.
  await team.reload();
  await statusForm.locator("select[name=to]").selectOption("supplier_committed");
  await statusForm.getByRole("button", { name: "Update status" }).click();
  await team.getByText("Status updated.").waitFor();
  await team.locator("form").filter({ has: team.getByRole("button", { name: "Update status" }) }).locator("select[name=to]").selectOption("confirmed");
  await team.locator("form").filter({ has: team.getByRole("button", { name: "Update status" }) }).getByRole("button", { name: "Update status" }).click();
  await team.getByText(/disabled until a payment policy is approved/).first().waitFor();
  check("booking confirmation is refused without an approved payment policy", true);

  await page.reload();
  const finalH1 = await page.locator("h1").innerText();
  check("customer status reflects operator committed, not booked", /Operator committed/.test(finalH1) && !/Booking confirmed/.test(finalH1), finalH1);
  check("payment status stays separate (no payment taken)", await page.getByText("No payment taken").isVisible());

  check("no browser page errors", pageErrors.length === 0, pageErrors.join(" | "));
  await browser.close();
} catch (e) {
  failures++;
  console.error("E2E crashed:", e);
} finally {
  stopServer();
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll e2e checks passed");
process.exit(failures ? 1 : 0);
