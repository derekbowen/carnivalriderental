import fs from "node:fs";
import { appEnv } from "../config";
import { LISTING_TYPE_ID } from "../contract";
import { normalizeAll, type CatalogRecord, type SharetribeListing } from "./normalize";

/**
 * Catalog source: published listings from the ACTIVE Sharetribe environment via the PUBLIC
 * Marketplace API (anonymous token). Public endpoints never return privateData, so nothing
 * operator-only can reach rendered output through this path.
 *
 * Bounded and cached: one query per TTL, not per page view.
 */
const AUTH_URL = "https://flex-api.sharetribe.com/v1/auth/token";
const API = "https://flex-api.sharetribe.com/v1/api";
const TTL_MS = 60_000;

let cache: { at: number; value: CatalogSnapshot } | null = null;

export interface CatalogSnapshot {
  records: CatalogRecord[];
  rejected: { listingId: string; reasons: string[] }[];
  fetchedAt: string;
  /** "test-harness-file" is used ONLY by automated tests outside production and is labelled on every page. */
  source: "sharetribe-marketplace-api" | "test-harness-file" | "not-configured" | "error";
  error?: string;
}

async function anonToken(clientId: string): Promise<string> {
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ client_id: clientId, grant_type: "client_credentials", scope: "public-read" }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`auth failed (HTTP ${res.status})`);
  return (await res.json()).access_token;
}

/** Raw public query. Exposed for the search proof script so it exercises the same path. */
export async function queryPublicListings(params: Record<string, string>): Promise<{ status: number; url: string; listings: SharetribeListing[]; body?: unknown }> {
  const clientId = process.env.SHARETRIBE_CLIENT_ID;
  if (!clientId) throw new Error("SHARETRIBE_CLIENT_ID not configured");
  const token = await anonToken(clientId);
  const qs = new URLSearchParams({ pub_listingType: LISTING_TYPE_ID, perPage: "100", ...params });
  const url = `${API}/listings/query?${qs}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal: AbortSignal.timeout(8000), cache: "no-store" });
  const body = await res.json().catch(() => null);
  return { status: res.status, url: url.replace(API, ""), listings: res.ok ? (body?.data ?? []) : [], body: res.ok ? undefined : body };
}

export async function getCatalog(force = false): Promise<CatalogSnapshot> {
  const harness = process.env.CATALOG_SOURCE_FILE;
  if (harness && appEnv() !== "production") {
    // Test harness: listings in Marketplace API response shape, re-read on every call (no cache).
    const listings = (JSON.parse(fs.readFileSync(harness, "utf8")) as { data: SharetribeListing[] }).data;
    return { ...normalizeAll(listings), fetchedAt: new Date().toISOString(), source: "test-harness-file" };
  }
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.value;
  let value: CatalogSnapshot;
  if (!process.env.SHARETRIBE_CLIENT_ID) {
    value = { records: [], rejected: [], fetchedAt: new Date().toISOString(), source: "not-configured" };
  } else {
    try {
      const r = await queryPublicListings({});
      if (r.status !== 200) throw new Error(`listings/query HTTP ${r.status}`);
      value = { ...normalizeAll(r.listings), fetchedAt: new Date().toISOString(), source: "sharetribe-marketplace-api" };
    } catch (e) {
      value = { records: [], rejected: [], fetchedAt: new Date().toISOString(), source: "error", error: (e as Error).message };
    }
  }
  cache = { at: Date.now(), value };
  return value;
}

export async function getCatalogRecordBySlug(slug: string) {
  const snap = await getCatalog();
  return { snap, record: snap.records.find((r) => r.slug === slug) ?? null };
}
