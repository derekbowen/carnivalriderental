import { chromium } from "@playwright/test";
const OUT = new URL(".", import.meta.url).pathname;
const b = await chromium.launch();
const route = async (rt) => { const r = rt.request(); try { const res = await fetch(r.url(), { headers: { "x-vercel-ip-country": "US" } }); const h = Object.fromEntries(res.headers.entries()); delete h["content-encoding"]; delete h["content-length"]; await rt.fulfill({ status: res.status, headers: h, body: Buffer.from(await res.arrayBuffer()) }); } catch { await rt.abort(); } };
for (const [label, vp] of [["desktop", { width: 1280, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: label === "mobile" ? 2 : 1, isMobile: label === "mobile" });
  const p = await ctx.newPage(); await p.route(/^https:\/\//, route);
  await p.goto("https://carnivalriderental.us/ohio/columbus", { waitUntil: "load", timeout: 90000 });
  await p.locator("footer").screenshot({ path: `${OUT}footer.${label}.png` });
  await ctx.close();
}
await b.close();
