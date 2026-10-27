/**
 * Release verification of the indexed set, against a running site.
 *
 *   npx tsx scripts/verify-release.ts https://carnivalriderental.us               # production, every URL
 *   npx tsx scripts/verify-release.ts https://carnivalriderental.us --sample 25   # every 25th sitemap URL
 *   npx tsx scripts/verify-release.ts http://localhost:3200                       # local production build
 *
 * Checks, and writes reports/release-verification-<host>.json:
 * - robots.txt: no blanket Disallow, private paths disallowed, the real sitemap advertised;
 * - sitemap.xml lists exactly the indexable set the gates compute for production (sitemapRoutes, with
 *   the retired managed catalog empty), as canonical production URLs, no query strings, no lastmod;
 * - every sitemap URL, or every Nth with --sample N (fetched 8 at a time): 200, indexable in HTML and
 *   headers, self-canonical, no private contact data, no Offer/price in JSON-LD;
 * - pages that stay out answer noindex (or 404 / auth) and are not in the sitemap: search results,
 *   filtered hubs, the request form and a city with too few rides nearby;
 * - old Test listing URLs answer 308 to the same listing in Live;
 * - Event Access is open on production (live Stripe keys): the event form renders, no "opening soon".
 */
import fs from "node:fs";

const base = (process.argv[2] ?? "https://carnivalriderental.us").replace(/\/$/, "");
const CANONICAL = "https://carnivalriderental.us";
const sampleArg = process.argv.indexOf("--sample");
const SAMPLE = sampleArg > 0 ? Math.max(1, Number(process.argv[sampleArg + 1]) || 1) : 1;
const rides = JSON.parse(fs.readFileSync("src/lib/inventory/rides.json", "utf8")) as { rides: { id: string }[] };
const testToLive = JSON.parse(fs.readFileSync("src/lib/inventory/test-to-live.json", "utf8")) as { map: Record<string, string> };

const results: { check: string; ok: boolean; detail?: string }[] = [];
const check = (name: string, ok: boolean, detail?: string) => {
  results.push({ check: name, ok, ...(detail ? { detail } : {}) });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? `  (${detail})` : ""}`);
};
const local = (u: string) => u.replace(CANONICAL, base);
async function get(path: string, redirect: RequestRedirect = "follow") {
  const res = await fetch(`${base}${path}`, { redirect, headers: { "User-Agent": "CarnivalRideRental-ReleaseCheck/1.0", Accept: "text/html,application/xml" }, signal: AbortSignal.timeout(60000) });
  return { status: res.status, headers: res.headers, text: redirect === "manual" ? "" : await res.text() };
}
/** Map with bounded concurrency, results in input order. */
async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}
const metaRobots = (html: string) => /<meta name="robots" content="([^"]*)"/i.exec(html)?.[1] ?? null;
const canonicalOf = (html: string) => /<link rel="canonical" href="([^"]*)"/i.exec(html)?.[1] ?? null;
const PRIVATE = [/mailto:(?!support@|claims@|hello@|notifications@)/i, /\b\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}\b/, /claimStatus|importExternalId|companyId|contactEmail|privateData|protectedData/];

(async () => {
  // The expected indexed set: the gates, evaluated as production (the same list the sitemap and IndexNow use).
  Object.assign(process.env, { APP_ENV: "production", PUBLIC_INDEXING: "true", SITE_URL: CANONICAL });
  const { sitemapRoutes } = await import("../src/lib/seo/sitemap-routes");
  const { inventoryRoutes } = await import("../src/lib/inventory");
  const routes = sitemapRoutes({ records: [], rejected: [], fetchedAt: "", source: "sharetribe-marketplace-api" });
  // robots.txt
  const robots = (await get("/robots.txt")).text;
  check("robots.txt has no blanket Disallow", !/^Disallow: \/\s*$/m.test(robots));
  for (const p of ["/pass", "/connect/", "/api", "/internal"]) check(`robots.txt disallows ${p}`, robots.includes(`Disallow: ${p}`));
  check("robots.txt advertises the production sitemap", robots.includes(`Sitemap: ${CANONICAL}/sitemap.xml`));

  // sitemap
  const sm = await get("/sitemap.xml");
  const locs = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const expected = routes.filter((r) => r.gate.indexable).map((r) => `${CANONICAL}${r.path === "/" ? "" : r.path}`);
  const norm = (u: string) => u.replace(/\/$/, "");
  const got = new Set(locs.map(norm));
  const want = new Set(expected.map(norm));
  check("sitemap.xml answers 200", sm.status === 200);
  check("sitemap lists exactly the indexable set", got.size === want.size && [...want].every((u) => got.has(u)), `listed ${got.size}, expected ${want.size}; missing ${[...want].filter((u) => !got.has(u)).join(" ") || "none"}; extra ${[...got].filter((u) => !want.has(u)).join(" ") || "none"}`);
  check("sitemap URLs are canonical HTTPS production URLs without query strings", locs.every((u) => u.startsWith(`${CANONICAL}`) && !u.includes("?")));
  check("sitemap carries no build-time lastmod", !sm.text.includes("<lastmod>"));

  // every indexed URL (or every Nth), 8 at a time (results reported in sitemap order)
  const pageChecks = await pool(locs.filter((_, i) => i % SAMPLE === 0), 8, async (u) => {
    const path = u.replace(CANONICAL, "") || "/";
    const r = await get(path);
    const robotsMeta = metaRobots(r.text) ?? "";
    const header = r.headers.get("x-robots-tag") ?? "";
    const canon = canonicalOf(r.text);
    const leaks = PRIVATE.filter((re) => re.test(r.text.replace(/"(photo|thumb|src|url)":"[^"]*"/g, "").replace(/src="[^"]*"/g, "")));
    const ld = [...r.text.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
    const ok = r.status === 200 && /(^|,\s*)index/.test(robotsMeta) && !/noindex/.test(robotsMeta) && !/noindex/.test(header) && norm(canon ?? "") === norm(u) && leaks.length === 0 && !/"Offer"|"price"/.test(ld);
    return { path, ok, detail: `status ${r.status}, robots "${robotsMeta}", x-robots-tag "${header}", canonical ${canon}, leaks ${leaks.length}` };
  });
  for (const c of pageChecks) check(`${c.path}: 200, index, self-canonical, no private data, no Offer`, c.ok, c.ok ? undefined : c.detail);

  // pages that stay out: noindex and not listed
  const live = rides.rides[0]?.id;
  // A city with too few rides nearby (a supply floor: noindex whatever the approval).
  const thin = inventoryRoutes().find((r) => r.family === "city" && r.gate.reasons.some((x) => x.startsWith("only ")))?.path;
  const excluded = ["/s", "/s?type=ferris-wheel", "/rides?category=ferris-wheels", ...(thin ? [thin] : []), "/connect", "/connect?listing=" + live];
  for (const path of excluded) {
    const r = await get(path);
    const robotsMeta = metaRobots(r.text) ?? "";
    const header = r.headers.get("x-robots-tag") ?? "";
    const noindex = /noindex/.test(robotsMeta) || /noindex/.test(header) || r.status === 404;
    check(`${path}: excluded (noindex or 404) and not in the sitemap`, noindex && !got.has(norm(`${CANONICAL}${path}`)), `status ${r.status}, robots "${robotsMeta}", x-robots-tag "${header}"`);
  }
  const pass = await get("/pass/00000000-0000-4000-8000-000000000000");
  check("/pass/{unknown}: no contact data, private", pass.status === 404 || /noindex/.test(pass.headers.get("x-robots-tag") ?? ""), `status ${pass.status}, cache ${pass.headers.get("cache-control")}`);
  const connect = await get("/connect");
  check("/connect: private, no-store", /no-store/.test(connect.headers.get("cache-control") ?? "") && /noindex/.test(connect.headers.get("x-robots-tag") ?? ""));

  // old Test listing URLs
  const pairs = Object.entries(testToLive.map).slice(0, 5);
  for (const [t, l] of pairs) {
    const r = await get(`/s/${t}`, "manual");
    check(`/s/{test id} → 308 /s/{live id}`, r.status === 308 && (r.headers.get("location") ?? "").endsWith(`/s/${l}`), `status ${r.status} → ${r.headers.get("location")}`);
  }
  const ridesById = new Map((JSON.parse(fs.readFileSync("src/lib/inventory/rides.json", "utf8")) as { rides: { id: string; rideType: string | null }[] }).rides.map((r) => [r.id, r]));
  const ferrisOld = Object.entries(testToLive.map).find(([, l]) => ridesById.get(l)?.rideType === "ferris-wheel");
  if (ferrisOld) {
    const c = await get(`/connect?listing=${ferrisOld[0]}`);
    check("/connect?listing={old Test Ferris id} → its Live listing, Ferris Wheel Event Access tier", c.text.includes('<p class="eyebrow">Ferris Wheel Event Access</p>') && c.text.includes('data-testid="connect-context"'));
  }
  // A missing URL is a real 404 with its own title (never a soft 404 that reads like the homepage).
  const missing = await get("/guides");
  const titles = [...missing.text.matchAll(/<title>([^<]*)<\/title>/g)].map((m) => m[1]);
  check("/guides (no index page): 404, one 'Page not found' title, noindex", missing.status === 404 && titles.length === 1 && /Page not found/.test(titles[0]) && /noindex/.test(metaRobots(missing.text) ?? ""), `status ${missing.status}, titles ${JSON.stringify(titles)}`);
  const unknown = await get("/s/00000000-0000-4000-8000-000000000000", "manual");
  check("/s/{unknown id} → 404 (never redirected elsewhere)", unknown.status === 404, `status ${unknown.status}`);

  // payments state on production: live Stripe keys since 2026-10-14, so the event form is open (a test key
  // on production would show "opening soon" instead and never a test checkout)
  check("/connect: Event Access open (event form, no 'opening soon')", connect.text.includes('data-testid="connect-form"') && !connect.text.includes("Event Access is opening soon"));

  const ok = results.every((r) => r.ok);
  const host = new URL(base).host.replace(/[^a-z0-9.-]/gi, "_");
  fs.mkdirSync("reports", { recursive: true });
  fs.writeFileSync(`reports/release-verification-${host}.json`, `${JSON.stringify({ checkedAt: new Date().toISOString(), base, passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results }, null, 2)}\n`);
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`);
  if (!ok) process.exitCode = 1;
})().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
