/**
 * Tell Bing about our indexable pages through IndexNow (founder go 2026-10-24). Bing shares IndexNow
 * submissions with the other participating engines, and DuckDuckGo and several AI search tools read
 * Bing's index. Google does not use IndexNow; it reads the sitemap.
 *
 *   npm run seo:indexnow              # dry run: counts by family and the first URLs
 *   npm run seo:indexnow -- --submit  # POST the list to api.indexnow.org
 *
 * The list is exactly the production sitemap's pages: the same gate objects, evaluated with indexing on,
 * and an empty managed catalog (retired; when it has live records the sitemap can only be larger, so this
 * never submits a page the sitemap leaves out). The key is the public file public/<key>.txt, which the
 * engines fetch to confirm the submission comes from this site. Run it after a deploy that opens pages.
 */
import fs from "node:fs";

const SITE = "https://carnivalriderental.us";
process.env.APP_ENV = "production";
process.env.PUBLIC_INDEXING = "true";
process.env.SITE_URL = SITE;

(async () => {
  const keyFile = fs.readdirSync("public").find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
  if (!keyFile) throw new Error("No IndexNow key file (public/<32 hex>.txt)");
  const key = keyFile.replace(/\.txt$/, "");
  if (fs.readFileSync(`public/${keyFile}`, "utf8").trim() !== key) throw new Error(`public/${keyFile} must contain exactly its own key`);

  const { sitemapRoutes } = await import("../src/lib/seo/sitemap-routes");
  const { canonicalUrl } = await import("../src/lib/seo/routes");
  const empty = { records: [], rejected: [], fetchedAt: new Date().toISOString(), source: "sharetribe-marketplace-api" as const };
  const routes = sitemapRoutes(empty).filter((r) => r.gate.indexable);
  const urls = [...new Set(routes.map((r) => canonicalUrl(r.path)))];
  const byFamily = routes.reduce<Record<string, number>>((a, r) => ((a[r.family] = (a[r.family] ?? 0) + 1), a), {});
  console.log(`${urls.length} indexable URLs ${JSON.stringify(byFamily)}`);
  if (!urls.every((u) => u.startsWith(`${SITE}/`) || u === SITE)) throw new Error("Refusing: a URL is not on the production host");
  if (!process.argv.includes("--submit")) {
    console.log(urls.slice(0, 8).join("\n"));
    console.log("DRY RUN — nothing submitted. Pass --submit to send.");
    return;
  }
  // IndexNow accepts up to 10,000 URLs per request.
  for (let i = 0; i < urls.length; i += 10_000) {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: new URL(SITE).host, key, keyLocation: `${SITE}/${keyFile}`, urlList: urls.slice(i, i + 10_000) }),
      signal: AbortSignal.timeout(30000),
    });
    // 200 OK / 202 Accepted (key check pending). 403: key file not reachable; 422: URLs not on the host.
    console.log(`IndexNow: HTTP ${res.status} for ${Math.min(10_000, urls.length - i)} URLs`);
    if (res.status !== 200 && res.status !== 202) process.exitCode = 1;
  }
})().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
