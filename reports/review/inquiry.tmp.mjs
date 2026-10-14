// Controlled inquiry: QA customer, an unclaimed ride from the Columbus page → request desk. No payment.
import { chromium } from "@playwright/test";
import fs from "node:fs";
const BASE = "https://carnivalriderental.us";
const OUT = new URL(".", import.meta.url).pathname;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
await p.route(/^https:\/\//, async (route) => {
  const r = route.request();
  try {
    const res = await fetch(r.url(), { method: r.method(), headers: { ...Object.fromEntries(Object.entries(r.headers()).filter(([k]) => !["host", "content-length"].includes(k))), "x-vercel-ip-country": "US" }, body: ["GET", "HEAD"].includes(r.method()) ? undefined : r.postDataBuffer() });
    const h = Object.fromEntries(res.headers.entries()); delete h["content-encoding"]; delete h["content-length"];
    if (!r.url().startsWith(BASE)) { h["access-control-allow-origin"] = "*"; h["access-control-allow-headers"] = "*"; }
    await route.fulfill({ status: res.status, headers: h, body: Buffer.from(await res.arrayBuffer()) });
  } catch { await route.abort(); }
});
p.on("console", (m) => m.type() === "error" && console.log("console:", m.text()));
await p.goto(`${BASE}/ohio/columbus`, { waitUntil: "load" });
const card = p.locator('[data-testid="ride-result"]').first();
const cardTitle = (await card.locator("h2").innerText()).trim();
const detailHref = await card.getByRole("link", { name: "View ride details" }).getAttribute("href");
const rideId = detailHref.split("/").pop();
await card.getByRole("link", { name: "Request a quote" }).click();
await p.waitForURL(/\/request\?/);
const requestUrl = p.url();
const routingNote = await p.locator("h1 + p").innerText();
const aside = await p.locator("aside").first().innerText().catch(() => "");
await p.fill("#eventDate", "2027-06-12");
await p.fill("#startTime", "12:00");
await p.fill("#endTime", "18:00");
await p.fill("#address", "1 QA Test Ln");
await p.fill("#city", "Columbus");
await p.selectOption("#state", "OH");
await p.fill("#zip", "43215");
await p.fill("#guests", "250");
await p.fill("#notes", "QA test request (controlled verification) - please ignore. No operator contact.");
await p.getByText("I have an account").click();
await p.fill("#email", process.env.QA_CUSTOMER_EMAIL);
await p.fill("#password", process.env.QA_CUSTOMER_PASSWORD);
await p.screenshot({ path: `${OUT}inquiry-form.png`, fullPage: true });
await p.getByRole("button", { name: "Send request" }).click();
await p.waitForSelector('[data-testid="request-sent"], p[role="alert"]', { timeout: 60000 });
const confirmation = (await p.locator('[data-testid="request-sent"], p[role="alert"]').first().innerText()).replace(/\n+/g, " | ");
await p.screenshot({ path: `${OUT}inquiry-confirmation.png`, fullPage: true });
const txId = /Reference: ([0-9a-f-]{36})/.exec(confirmation)?.[1] ?? null;
const out = { cardTitle, rideId, requestUrl, routingNote, aside: aside.replace(/\n+/g, " | "), confirmation, txId };
fs.writeFileSync(`${OUT}inquiry.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await b.close();
