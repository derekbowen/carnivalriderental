/**
 * Near-duplicate report for inventory pSEO pages (read-only; writes reports/pseo-duplicates.json).
 *   npm run pseo:duplicates
 *
 * Adjacent city pages share one template, so what distinguishes them is the listing set and its
 * order. For every pair of supply-sufficient pages whose cities are within PAIR_MILES, compare:
 *   - full: Jaccard overlap of all listing IDs within the radius
 *   - shown: overlap of the 12 cards actually displayed (city) / 24 (ride + city), as a set
 *   - sameOrder: the displayed cards are identical AND in the same order
 * Pages linked by full ≥ DUP_JACCARD AND shown ≥ DUP_SHOWN are grouped (union-find). Each group
 * names a head: the most populous city.
 *
 * Founder decision (2026-10-05, option 1): only a group head (or a page in no group) may ever be
 * indexed. This script also writes src/lib/inventory/index-eligible.json, the list of those pages,
 * stamped with the snapshot it was computed from; the inventory gates read it (stale → nothing
 * indexable). Rerun after every inventory export. Nothing is redirected or re-canonicalised.
 */
import fs from "node:fs";
import { milesBetween } from "../src/lib/catalog/operator-search";
import { CITIES, INVENTORY_GENERATED_AT, PSEO_INVENTORY, ridesNear, type City } from "../src/lib/inventory";
import { US_STATES } from "../src/lib/taxonomy";

const PAIR_MILES = 60;
const DUP_JACCARD = 0.9;
const DUP_SHOWN = 0.9;
const slug = (c: City) => `/${US_STATES.find((s) => s.code === c.state)!.slug}/${c.slug}`;

interface Page { path: string; city: City; ids: string[]; shown: string[] }
const jaccard = (a: Set<string>, b: Set<string>) => {
  let i = 0;
  for (const x of a) if (b.has(x)) i++;
  return a.size + b.size === 0 ? 1 : i / (a.size + b.size - i);
};

function analyse(family: string, pages: Page[]) {
  const sets = pages.map((p) => ({ full: new Set(p.ids), shown: new Set(p.shown) }));
  const parent = pages.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const pairs: { a: string; b: string; miles: number; full: number; shown: number; sameOrder: boolean }[] = [];
  for (let i = 0; i < pages.length; i++) {
    for (let j = i + 1; j < pages.length; j++) {
      const miles = Math.round(milesBetween(pages[i].city, pages[j].city));
      if (miles > PAIR_MILES) continue;
      const full = jaccard(sets[i].full, sets[j].full);
      const shown = jaccard(sets[i].shown, sets[j].shown);
      const sameOrder = pages[i].shown.join() === pages[j].shown.join();
      pairs.push({ a: pages[i].path, b: pages[j].path, miles, full: +full.toFixed(3), shown: +shown.toFixed(3), sameOrder });
      if (full >= DUP_JACCARD && shown >= DUP_SHOWN) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, Page[]>();
  pages.forEach((p, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), p]));
  const dupGroups = [...groups.values()].filter((g) => g.length > 1)
    .map((g) => g.sort((a, b) => b.city.pop - a.city.pop))
    .sort((a, b) => b.length - a.length);
  const pct = (n: number) => (pairs.length ? +((100 * n) / pairs.length).toFixed(1) : 0);
  return {
    family,
    pages: pages.length,
    adjacentPairs: pairs.length,
    pairsFullOverlapAtLeast90pct: pct(pairs.filter((p) => p.full >= 0.9).length),
    pairsShownIdenticalSet: pct(pairs.filter((p) => p.shown === 1).length),
    pairsShownIdenticalOrder: pct(pairs.filter((p) => p.sameOrder).length),
    medianFullOverlap: pairs.length ? [...pairs].sort((a, b) => a.full - b.full)[Math.floor(pairs.length / 2)].full : null,
    nearDuplicateGroups: dupGroups.length,
    pagesInNearDuplicateGroups: dupGroups.reduce((n, g) => n + g.length, 0),
    distinctPagesAfterGrouping: pages.length - dupGroups.reduce((n, g) => n + g.length - 1, 0),
    largestGroups: dupGroups.slice(0, 15).map((g) => ({ head: g[0].path, size: g.length, members: g.slice(1, 12).map((p) => p.path) })),
    groupHeadOf: Object.fromEntries(dupGroups.flatMap((g) => g.map((p) => [p.path, g[0].path]))),
  };
}

const cityPages: Page[] = [];
const rideCityPages = new Map<string, Page[]>();
for (const c of CITIES) {
  const near = ridesNear(c.lat, c.lng);
  if (near.length >= PSEO_INVENTORY.cityMinRides) cityPages.push({ path: slug(c), city: c, ids: near.map((r) => r.id), shown: near.slice(0, 12).map((r) => r.id) });
  const byType = new Map<string, string[]>();
  for (const r of near) if (r.rideType) byType.set(r.rideType, [...(byType.get(r.rideType) ?? []), r.id]);
  for (const [t, ids] of byType) {
    if (ids.length < PSEO_INVENTORY.rideCityMinRides) continue;
    rideCityPages.set(t, [...(rideCityPages.get(t) ?? []), { path: `${slug(c)}/${t}`, city: c, ids, shown: ids.slice(0, 24) }]);
  }
}

const city = analyse("city", cityPages);
const rideCity = [...rideCityPages].map(([t, pages]) => analyse(`ride-city:${t}`, pages));
const sum = (k: "pages" | "distinctPagesAfterGrouping" | "pagesInNearDuplicateGroups") => rideCity.reduce((n, r) => n + r[k], 0);
const out = {
  generatedFrom: "src/lib/inventory/rides.json + src/lib/geo/cities.json",
  settings: { radiusMiles: PSEO_INVENTORY.radiusMiles, pairMiles: PAIR_MILES, dupJaccard: DUP_JACCARD, dupShown: DUP_SHOWN },
  city: { ...city, groupHeadOf: undefined },
  rideCitySummary: { pages: sum("pages"), pagesInNearDuplicateGroups: sum("pagesInNearDuplicateGroups"), distinctPagesAfterGrouping: sum("distinctPagesAfterGrouping") },
  rideCityByType: rideCity.map((r) => ({ ...r, groupHeadOf: undefined, largestGroups: r.largestGroups.slice(0, 5) })).sort((a, b) => b.pages - a.pages),
  groupHeadOf: { ...city.groupHeadOf, ...Object.assign({}, ...rideCity.map((r) => r.groupHeadOf)) },
};
const headOf = out.groupHeadOf as Record<string, string>;
const allPages = [...cityPages, ...[...rideCityPages.values()].flat()].map((p) => p.path);
const eligible = allPages.filter((p) => (headOf[p] ?? p) === p).sort();
fs.writeFileSync("src/lib/inventory/index-eligible.json", `${JSON.stringify({ inventoryGeneratedAt: INVENTORY_GENERATED_AT, settings: out.settings, count: eligible.length, paths: eligible })}\n`);
fs.mkdirSync("reports", { recursive: true });
fs.writeFileSync("reports/pseo-duplicates.json", `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({ city: { ...city, largestGroups: city.largestGroups.slice(0, 6).map((g) => `${g.head} (+${g.size - 1})`), groupHeadOf: undefined }, rideCity: out.rideCitySummary }, null, 2));
