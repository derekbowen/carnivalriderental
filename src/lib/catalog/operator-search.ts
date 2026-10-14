import contract from "../../../contract/operator-listing-contract.json";
import { listingPriceLabel } from "../pricing/public-price";

/**
 * Read side for OPERATOR ride listings (listing type operator-ride-rental), used by the /s search
 * page. Same rules as the rest of src/lib/catalog: public Marketplace API only (anonymous
 * public-read token, client ID only, never the Integration API), and every listing is re-checked
 * here because Console edits bypass our write validators. Only approved public keys reach a card.
 *
 * Sorting: Sharetribe's `origin` parameter returns listings nearest-first from a point, so every
 * search is a distance sort from the visitor (exact browser location, else their IP location).
 */
const AUTH_URL = "https://flex-api.sharetribe.com/v1/auth/token";
const API = "https://flex-api.sharetribe.com/v1/api";
export const OPERATOR_LISTING_TYPE = contract.listingType.id;
export const PER_PAGE = 24;
const TTL_MS = 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const RIDE_CLASSES: { id: string; label: string }[] = contract.rideClass.options.map((o) => ({ id: o.option, label: o.label }));
const CLASS_LABEL = new Map(RIDE_CLASSES.map((c) => [c.id, c.label]));
export const isRideClass = (v: string | undefined): v is string => !!v && CLASS_LABEL.has(v);
export const isListingId = (v: string | undefined): v is string => !!v && UUID.test(v);

export interface LatLng {
  lat: number;
  lng: number;
}

export interface OperatorCard {
  id: string;
  title: string;
  rideClass: string | null;
  rideClassLabel: string | null;
  /**
   * Operator's home state (uppercase), never the city or company: founder decision 2026-10-05 —
   * customers must not be able to look the operator up and bypass the marketplace.
   */
  homeState: string | null;
  photo: { src: string; alt: string } | null;
  /** Larger variant of the same photo (2x landscape crop) for hero and detail images; null when the API did not return one. */
  photoLarge: { src: string; alt: string } | null;
  /** Straight-line miles from the search origin to the operator's (rounded) base. */
  miles: number | null;
  /** Approved operator rate for this listing and unit (src/lib/pricing/public-price.ts), else null → "Request a quote". */
  price: string | null;
  /** Listing author's account has been claimed by the verified operator (listing metadata.claimStatus). */
  claimed: boolean;
  /** The Sharetribe listing page renders (inquiry process alias set); otherwise no details link. */
  detailsReady: boolean;
}

export interface SearchResult {
  cards: OperatorCard[];
  totalItems: number;
  totalPages: number;
  page: number;
  error?: string;
}

interface ApiListing {
  id: string;
  type: string;
  attributes: {
    title?: string;
    state?: string;
    deleted?: boolean;
    geolocation?: { lat: number; lng: number } | null;
    publicData?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    price?: { amount?: number; currency?: string } | null;
  };
  relationships?: { author?: { data?: { id: string } }; images?: { data?: { id: string }[] } };
}
interface ApiIncluded {
  id: string;
  type: string;
  attributes: { profile?: { displayName?: string }; variants?: Record<string, { url: string } | undefined> };
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function milesBetween(a: LatLng, b: LatLng): number {
  const R = 3958.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Public API listing → card. Returns null (never rendered) for anything that isn't a live operator listing. */
export function toOperatorCard(l: ApiListing, included: ApiIncluded[], origin: LatLng | null): OperatorCard | null {
  const a = l.attributes ?? {};
  const pd = a.publicData ?? {};
  const title = str(a.title);
  if (l.type !== "listing" || a.deleted || a.state !== "published" || !title || pd.listingType !== OPERATOR_LISTING_TYPE) return null;
  if (a.metadata?.requestDesk === true || a.metadata?.qa === true) return null; // the request desk and QA fixtures are not rides
  const byKey = new Map(included.map((i) => [`${i.type}/${i.id}`, i]));
  const imageId = l.relationships?.images?.data?.[0]?.id;
  const image = imageId ? byKey.get(`image/${imageId}`) : undefined;
  const photoUrl = image?.attributes.variants?.["landscape-crop"]?.url ?? image?.attributes.variants?.["square-small"]?.url ?? null;
  const largeUrl = image?.attributes.variants?.["landscape-crop2x"]?.url ?? null;
  const rideClass = isRideClass(str(pd.rideClass) ?? undefined) ? (pd.rideClass as string) : null;
  const geo = a.geolocation && Number.isFinite(a.geolocation.lat) && Number.isFinite(a.geolocation.lng) ? a.geolocation : null;
  return {
    id: l.id,
    title,
    rideClass,
    rideClassLabel: rideClass ? CLASS_LABEL.get(rideClass) ?? null : null,
    homeState: str(pd.homeState)?.toUpperCase() ?? null,
    photo: photoUrl && photoUrl.startsWith("https://") ? { src: photoUrl, alt: title } : null,
    photoLarge: largeUrl && largeUrl.startsWith("https://") ? { src: largeUrl, alt: title } : null,
    miles: origin && geo ? Math.round(milesBetween(origin, geo)) : null,
    price: listingPriceLabel({ claimed: a.metadata?.claimStatus === "claimed", price: a.price, priceApproved: a.metadata?.priceApproved, unitType: pd.unitType }),
    claimed: a.metadata?.claimStatus === "claimed",
    detailsReady: typeof pd.transactionProcessAlias === "string" && pd.transactionProcessAlias.length > 0,
  };
}

type ApiBody = { data: ApiListing | ApiListing[]; included?: ApiIncluded[]; meta?: { totalItems: number; totalPages: number; page: number } };

let token: { value: string; exp: number } | null = null;
let tokenInFlight: Promise<string> | null = null;
/** One shared anonymous token; concurrent callers wait for the same request. */
async function anonToken(): Promise<string> {
  if (token && token.exp > Date.now()) return token.value;
  tokenInFlight ??= fetchAnonToken().finally(() => (tokenInFlight = null));
  return tokenInFlight;
}
async function fetchAnonToken(): Promise<string> {
  const clientId = process.env.SHARETRIBE_CLIENT_ID;
  if (!clientId) throw new Error("SHARETRIBE_CLIENT_ID not configured");
  if (token && token.exp > Date.now()) return token.value;
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ client_id: clientId, grant_type: "client_credentials", scope: "public-read" }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`auth failed (HTTP ${res.status})`);
  const j = (await res.json()) as { access_token: string; expires_in?: number };
  token = { value: j.access_token, exp: Date.now() + Math.max(60, (j.expires_in ?? 3600) - 120) * 1000 };
  return token.value;
}

async function apiGet(path: string, params: Record<string, string>, revalidate = 60, retry = true): Promise<ApiBody> {
  // Author (company) is deliberately not fetched: operator identity is never shown on our pages.
  const qs = new URLSearchParams({ include: "images", "fields.image": "variants.landscape-crop,variants.landscape-crop2x,variants.square-small", ...params });
  const res = await fetch(`${API}${path}?${qs}`, { headers: { Authorization: `Bearer ${await anonToken()}`, Accept: "application/json" }, signal: AbortSignal.timeout(8000), next: { revalidate } });
  if (res.status === 429 && retry) {
    await new Promise((r) => setTimeout(r, 1200));
    return apiGet(path, params, revalidate, false);
  }
  if (!res.ok) throw new Error(`listing query failed (HTTP ${res.status})`);
  return (await res.json()) as ApiBody;
}

const cache = new Map<string, { at: number; value: SearchResult }>();

/** Nearest-first search from `origin` (rounded to ~1 km for caching). */
export async function searchOperatorListings(q: { origin: LatLng; page?: number; rideClass?: string }): Promise<SearchResult> {
  const page = Math.min(Math.max(1, Math.floor(q.page ?? 1)), 100);
  const origin = { lat: Math.round(q.origin.lat * 100) / 100, lng: Math.round(q.origin.lng * 100) / 100 };
  const key = `${origin.lat},${origin.lng}|${page}|${q.rideClass ?? ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  try {
    const params: Record<string, string> = { pub_listingType: OPERATOR_LISTING_TYPE, origin: `${origin.lat},${origin.lng}`, page: String(page), perPage: String(PER_PAGE) };
    // Always filter on ride class (all classes = OR): the request desk and QA fixtures carry no
    // rideClass, so they never count towards totals or take a slot on a page.
    params.pub_rideClass = isRideClass(q.rideClass) ? q.rideClass : RIDE_CLASSES.map((c) => c.id).join(",");
    const body = await apiGet("/listings/query", params);
    const list = Array.isArray(body.data) ? body.data : [];
    const cards = list.map((l) => toOperatorCard(l, body.included ?? [], origin)).filter((c): c is OperatorCard => c !== null);
    const value = { cards, totalItems: body.meta?.totalItems ?? cards.length, totalPages: body.meta?.totalPages ?? 1, page };
    if (cache.size > 500) cache.clear();
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (e) {
    return { cards: [], totalItems: 0, totalPages: 0, page, error: (e as Error).message };
  }
}

export interface OperatorRideDetail extends OperatorCard {
  /** Approved public facts only (contract publicFields); never description text, company or city. */
  facts: { label: string; value: string }[];
}

const STATE_NAMES_UPPER = (codes: unknown) => (Array.isArray(codes) ? codes.filter((c) => typeof c === "string").map((c: string) => c.toUpperCase()) : []);

/** Approved public facts of a listing, in display order. Exported for tests. */
export function rideFacts(pd: Record<string, unknown>): { label: string; value: string }[] {
  const f: { label: string; value: string }[] = [];
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
  if (str(pd.manufacturer)) f.push({ label: "Manufacturer", value: str(pd.manufacturer)! });
  if (str(pd.rideModel)) f.push({ label: "Model", value: str(pd.rideModel)! });
  if (num(pd.minRiderHeightIn)) f.push({ label: "Minimum rider height", value: `${num(pd.minRiderHeightIn)} in` });
  const L = num(pd.footprintLengthFt), W = num(pd.footprintWidthFt), H = num(pd.rideHeightFt);
  if (L && W) f.push({ label: "Space needed (operator's figure)", value: `${L} ft × ${W} ft` });
  if (H) f.push({ label: "Ride height (operator's figure)", value: `${H} ft` });
  if (str(pd.riderRules)) f.push({ label: "Rider rules", value: str(pd.riderRules)! });
  const served = STATE_NAMES_UPPER(pd.serviceStates);
  if (served.length) f.push({ label: "States served", value: served.length >= 50 ? "All states" : served.join(", ") });
  return f;
}

/** One live operator listing (request form prefill and our ride detail page), or null. */
export async function getOperatorListing(id: string): Promise<OperatorRideDetail | null> {
  if (!isListingId(id)) return null;
  try {
    const body = await apiGet("/listings/show", { id });
    if (Array.isArray(body.data)) return null;
    const card = toOperatorCard(body.data, body.included ?? [], null);
    return card ? { ...card, facts: rideFacts(body.data.attributes.publicData ?? {}) } : null;
  } catch {
    return null;
  }
}

/**
 * Listing → author (operator account) id for a set of listings, via the public API. The included
 * author resource is the anonymised public profile; only its id is used (src/lib/access/matching.ts).
 */
export async function listingAuthorIds(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100).filter(isListingId);
    if (batch.length === 0) continue;
    // The author relationship is only present when the author is included; `fields.user=` keeps the
    // included profile to its id (no name, no public fields).
    const qs = new URLSearchParams({ ids: batch.join(","), "fields.listing": "title", include: "author", "fields.user": "", perPage: "100" });
    const res = await fetch(`${API}/listings/query?${qs}`, { headers: { Authorization: `Bearer ${await anonToken()}`, Accept: "application/json" }, signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!res.ok) throw new Error(`listing author lookup failed (HTTP ${res.status})`);
    const body = (await res.json()) as { data?: ApiListing[] };
    for (const l of body.data ?? []) {
      const author = l.relationships?.author?.data?.id;
      if (author) out.set(l.id, author);
    }
  }
  return out;
}

// ------------------------------------------------------------------------------- visitor location

/** Geographic centre of the contiguous US: the fallback when nothing better is known. */
export const US_CENTER: LatLng & { label: string } = { lat: 39.83, lng: -98.58, label: "the United States" };

/** `?near=lat,lng` from the browser's "use my location" button. */
export function parseNear(v: string | undefined): LatLng | null {
  const m = v?.match(/^(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

/** Vercel's IP geolocation headers (approximate, US visitors only). */
export function ipLocation(h: { get(name: string): string | null }): (LatLng & { label: string }) | null {
  if (h.get("x-vercel-ip-country") !== "US") return null;
  const lat = Number(h.get("x-vercel-ip-latitude"));
  const lng = Number(h.get("x-vercel-ip-longitude"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  const city = decodeURIComponent(h.get("x-vercel-ip-city") ?? "").trim();
  const region = (h.get("x-vercel-ip-country-region") ?? "").trim();
  return { lat, lng, label: city ? `${city}${region ? `, ${region}` : ""}` : "your area" };
}

export interface ClassShowcase {
  id: string;
  label: string;
  count: number;
  photo: { src: string; alt: string } | null;
}

/**
 * Real ride counts and one real photo per ride class (homepage "Browse by ride type"). One small
 * query per class, cached by Next for 10 minutes. Classes with no live rides are omitted.
 */
let showcaseCache: { at: number; value: ClassShowcase[] } | null = null;

export async function rideClassShowcase(): Promise<ClassShowcase[]> {
  // Sequential (the Test marketplace rate-limits bursts of parallel queries from one IP), with the
  // last good result kept in memory so a transient failure never empties the homepage.
  if (showcaseCache && Date.now() - showcaseCache.at < 600_000) return showcaseCache.value;
  const out: ClassShowcase[] = [];
  for (const c of RIDE_CLASSES) {
    try {
      const body = await apiGet("/listings/query", { pub_listingType: OPERATOR_LISTING_TYPE, pub_rideClass: c.id, perPage: "8" }, 600);
      const cards = (Array.isArray(body.data) ? body.data : []).map((l) => toOperatorCard(l, body.included ?? [], null)).filter((x): x is OperatorCard => !!x);
      const count = body.meta?.totalItems ?? cards.length;
      if (count > 0) out.push({ id: c.id, label: c.label, count, photo: cards.find((x) => x.photo)?.photo ?? null });
    } catch {
      return showcaseCache?.value ?? out;
    }
  }
  showcaseCache = { at: Date.now(), value: out };
  return out;
}
