import { chromium } from "@playwright/test";
import fs from "node:fs";
const BASE = "https://carnivalriderental.us";
const URLS = ["/ohio/columbus", "/ohio/columbus/ferris-wheel", "/texas/austin/carousel", "/texas/houston/kiddie-train", "/alaska/anchorage"];
const OUT = new URL(".", import.meta.url).pathname;
const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
const robotsTxt = await (await fetch(`${BASE}/robots.txt`)).text();
const b = await chromium.launch();
const route = async (rt) => { const r = rt.request(); try { const res = await fetch(r.url(), { headers: { "x-vercel-ip-country": "US" } }); const h = Object.fromEntries(res.headers.entries()); delete h["content-encoding"]; delete h["content-length"]; await rt.fulfill({ status: res.status, headers: h, body: Buffer.from(await res.arrayBuffer()) }); } catch { await rt.abort(); } };
const results = [];
for (const u of URLS) {
  const res = await fetch(BASE + u, { redirect: "manual" });
  const name = u.slice(1).replace(/\//g, "_");
  const row = { url: BASE + u, status: res.status, xRobotsTag: res.headers.get("x-robots-tag"), inSitemap: sitemap.includes(`${BASE}${u}<`) };
  for (const [label, vp] of [["desktop", { width: 1280, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: label === "mobile" ? 2 : 1, isMobile: label === "mobile", hasTouch: label === "mobile" });
    const p = await ctx.newPage();
    await p.route(/^https:\/\//, route);
    await p.goto(BASE + u, { waitUntil: "load", timeout: 90000 });
    await p.waitForTimeout(1200);
    const h = await p.evaluate(() => document.documentElement.scrollHeight);
    await p.screenshot({ path: `${OUT}${name}.${label}.png`, clip: { x: 0, y: 0, width: vp.width, height: Math.min(h, label === "mobile" ? 2400 : 1700) } });
    if (label === "desktop") {
      Object.assign(row, await p.evaluate(() => {
        const q = (s) => document.querySelector(s);
        const card = q('[data-testid="ride-result"]');
        return {
          title: document.title,
          robotsMeta: q('meta[name="robots"]')?.getAttribute("content") ?? null,
          canonical: q('link[rel="canonical"]')?.getAttribute("href") ?? null,
          h1: q("h1")?.innerText ?? null,
          intro: q("h1 + p")?.innerText ?? null,
          statsLine: q('[data-testid="inventory-line"]')?.innerText ?? null,
          cards: document.querySelectorAll('[data-testid="ride-result"]').length,
          firstCard: card ? card.innerText.replace(/\n+/g, " | ") : null,
          cta: [...document.querySelectorAll("section, div")].find((e) => /Planning an event in/.test(e.querySelector("h2")?.innerText ?? ""))?.innerText.replace(/\n+/g, " | ").slice(0, 300) ?? null,
          banner: document.body.innerText.split("\n")[0],
          dollarAmounts: (document.body.innerText.match(/\$\s?\d[\d,]*/g) ?? []),
          forbidden: (document.body.innerText.match(/\b(verified|partner|available now|book now|estimated)\b/gi) ?? []),
        };
      }));
    }
    await ctx.close();
  }
  results.push(row);
}
await b.close();
fs.writeFileSync(`${OUT}review.json`, JSON.stringify({ capturedAt: new Date().toISOString(), robotsTxt, sitemapLocCount: (sitemap.match(/<loc>/g) ?? []).length, results }, null, 2));
console.log(JSON.stringify({ robotsTxt, sitemapLocCount: (sitemap.match(/<loc>/g) ?? []).length, results }, null, 2));
