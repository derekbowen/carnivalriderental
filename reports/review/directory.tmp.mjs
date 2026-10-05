import { chromium } from "@playwright/test";
const OUT = new URL(".", import.meta.url).pathname;
const B = "https://carnivalriderental.us";
const b = await chromium.launch();
const route = async (rt) => { const r = rt.request(); try { const res = await fetch(r.url(), { headers: { "x-vercel-ip-country": "US" } }); const h = Object.fromEntries(res.headers.entries()); delete h["content-encoding"]; delete h["content-length"]; await rt.fulfill({ status: res.status, headers: h, body: Buffer.from(await res.arrayBuffer()) }); } catch { await rt.abort(); } };
const shots = [["/directory", "directory", 1280, 1400], ["/directory/ohio", "directory-ohio", 1280, 1600], ["/directory/ohio", "directory-ohio.mobile", 390, 1800]];
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage(); await p.route(/^https:\/\//, route);
for (const [u, name, w, h] of shots) { await p.setViewportSize({ width: w, height: 900 }); await p.goto(B + u, { waitUntil: "load", timeout: 90000 }); await p.screenshot({ path: `${OUT}${name}.png`, clip: { x: 0, y: 0, width: w, height: h } }); }
// listing detail reached from the Columbus Ferris wheel page
await p.setViewportSize({ width: 1280, height: 900 });
await p.goto(B + "/ohio/columbus/ferris-wheel", { waitUntil: "load" });
const href = await p.locator('[data-testid="ride-result"]').first().getByRole("link", { name: "View ride details" }).getAttribute("href");
await p.goto(B + href, { waitUntil: "load" });
console.log("detail", href, "| crumbs:", (await p.getByRole("navigation", { name: "Breadcrumb" }).innerText()).replace(/\n/g, " › "));
await p.screenshot({ path: `${OUT}listing-detail.png`, fullPage: true });
await b.close();
