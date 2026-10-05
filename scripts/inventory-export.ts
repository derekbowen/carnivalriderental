/**
 * Public inventory snapshot for the pSEO pages: src/lib/inventory/rides.json.
 *
 * Reads ONLY the public Marketplace API (client ID, no secrets), so it can run anywhere, including
 * a build or cron on the pSEO side. Keeps public, non-identifying fields: never the operator's
 * company, city, website or description text (founder decision 2026-10-05). Geolocation is the
 * listing's already-rounded (~11 km) operator base, used only for distance.
 *
 *   npm run inventory:export
 */
import fs from "node:fs";
import { rideFacts } from "../src/lib/catalog/operator-search";
import { rideTypeFor } from "../src/lib/inventory/match";
import { rateKeyFor } from "../src/lib/pricing/rate-card";
import { AUTH, MKT } from "./lib/sharetribe-client";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface InventoryRide {
  id: string;
  title: string;
  rideClass: string | null;
  rideType: string | null;
  rateKey: string;
  homeState: string | null;
  serviceStates: string[];
  lat: number;
  lng: number;
  photo: string | null;
  thumb: string | null;
  facts: { label: string; value: string }[];
  claimed: boolean;
}

(async () => {
  const tok = (await (await fetch(AUTH, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.SHARETRIBE_CLIENT_ID!, grant_type: "client_credentials", scope: "public-read" }) })).json()).access_token;
  const rides: InventoryRide[] = [];
  for (let page = 1; ; page++) {
    const qs = new URLSearchParams({ pub_listingType: "operator-ride-rental", perPage: "100", page: String(page), include: "images", "fields.image": "variants.landscape-crop,variants.square-small" });
    let body: { data: { id: string; attributes: { title: string; state: string; geolocation?: { lat: number; lng: number }; publicData?: Record<string, unknown>; metadata?: Record<string, unknown> }; relationships?: { images?: { data: { id: string }[] } } }[]; included?: { id: string; type: string; attributes: { variants: Record<string, { url: string }> } }[]; meta: { totalPages: number } };
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`${MKT}/listings/query?${qs}`, { headers: { Authorization: `Bearer ${tok}`, Accept: "application/json" } });
      if (res.status === 429 && attempt < 5) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error(`listings/query page ${page}: HTTP ${res.status}`);
      body = await res.json();
      break;
    }
    const imgs = new Map((body.included ?? []).filter((i) => i.type === "image").map((i) => [i.id, i.attributes.variants]));
    for (const l of body.data) {
      const a = l.attributes;
      const pd = a.publicData ?? {};
      if (a.state !== "published" || a.metadata?.requestDesk === true || a.metadata?.qa === true || !a.geolocation || typeof pd.rideClass !== "string") continue;
      const v = imgs.get(l.relationships?.images?.data?.[0]?.id ?? "");
      rides.push({
        id: l.id,
        title: a.title,
        rideClass: pd.rideClass,
        rideType: rideTypeFor(a.title, pd.rideClass),
        rateKey: rateKeyFor(pd.rideClass, a.title),
        homeState: typeof pd.homeState === "string" ? pd.homeState : null,
        serviceStates: Array.isArray(pd.serviceStates) ? (pd.serviceStates as string[]) : [],
        lat: Math.round(a.geolocation.lat * 10) / 10,
        lng: Math.round(a.geolocation.lng * 10) / 10,
        photo: v?.["landscape-crop"]?.url ?? null,
        thumb: v?.["square-small"]?.url ?? null,
        facts: rideFacts(pd),
        claimed: a.metadata?.claimStatus === "claimed",
      });
    }
    if (page >= body.meta.totalPages) break;
    await sleep(1100);
  }
  rides.sort((a, b) => a.id.localeCompare(b.id));
  const out = { generatedAt: new Date().toISOString(), source: "Sharetribe Marketplace API (public listing data only)", count: rides.length, rides };
  fs.writeFileSync("src/lib/inventory/rides.json", `${JSON.stringify(out)}\n`);
  console.log(`Exported ${rides.length} rides; ${rides.filter((r) => r.rideType).length} matched to a ride type; ${rides.filter((r) => r.photo).length} with photos.`);
})().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
