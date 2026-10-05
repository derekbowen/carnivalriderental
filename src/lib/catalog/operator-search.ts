import contract from "../../../contract/operator-listing-contract.json";
import { estimateText, rateKeyFor } from "../pricing/rate-card";

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
  /** "City, ST" as published on the listing (operator base, not the event location). */
  base: string | null;
  homeState: string | null;
  company: string | null;
  photo: { src: string; alt: string } | null;
  /** Straight-line miles from the search origin to the operator's (rounded) base. */
  miles: number | null;
  /** Rate-card estimate line, or null when that ride size has no confirmed rate. */
  estimate: string | null;
  /** Listing author's account has been claimed by the verified operator (listing metadata.claimStatus). */
  claimed: boolean;
  /** The Sharetribe listing page renders (inquiry process alias set); otherwise no details link. */
  detailsReady: boolean;
  /**
   * True only when the transactional side has recorded that EVERY booking condition holds
   * (metadata.bookable, written by `npm run ops:bookable` after authoritative server-side checks;
   * see src/lib/operators/claim.ts → bookingBlockers). Never inferred from a browser redirect.
   */
  bookable: boolean;
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
  if (a.metadata?.requestDesk === true) return null; // the house request desk is not a ride
  const byKey = new Map(included.map((i) => [`${i.type}/${i.id}`, i]));
  const authorId = l.relationships?.author?.data?.id;
  const imageId = l.relationships?.images?.data?.[0]?.id;
  const image = imageId ? byKey.get(`image/${imageId}`) : undefined;
  const photoUrl = image?.attributes.variants?.["landscape-crop"]?.url ?? image?.attributes.variants?.["square-small"]?.url ?? null;
  const rideClass = isRideClass(str(pd.rideClass) ?? undefined) ? (pd.rideClass as string) : null;
  const geo = a.geolocation && Number.isFinite(a.geolocation.lat) && Number.isFinite(a.geolocation.lng) ? a.geolocation : null;
  const company = authorId ? str(byKey.get(`user/${authorId}`)?.attributes.profile?.displayName) : null;
  const address = (pd.location as { address?: unknown } | undefined)?.address;
  return {
    id: l.id,
    title,
    rideClass,
    rideClassLabel: rideClass ? CLASS_LABEL.get(rideClass) ?? null : null,
    base: str(address),
    homeState: str(pd.homeState),
    company,
    photo: photoUrl && photoUrl.startsWith("https://") ? { src: photoUrl, alt: company ? `${title} from ${company}` : title } : null,
    miles: origin && geo ? Math.round(milesBetween(origin, geo)) : null,
    estimate: estimateText(rateKeyFor(rideClass ?? "other", title)),
    claimed: a.metadata?.claimStatus === "claimed",
    detailsReady: typeof pd.transactionProcessAlias === "string" && pd.transactionProcessAlias.length > 0,
    bookable: a.metadata?.claimStatus === "claimed" && a.metadata?.bookable === true,
  };
}

let token: { value: string; exp: number } | null = null;
async function anonToken(): Promise<string> {
  const clientId = process.env.SHARETRIBE_CLIENT_ID;
  if (!clientId) throw new Error("SHARETRIBE_CLIENT_ID not configured");
  if (token && token.exp > Date.now()) return token.value;
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ client_id: clientId, grant_type: "client_credentials", scope: "public-read" }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`auth failed (HTTP ${res.status})`);
  const j = (await res.json()) as { access_token: string; expires_in?: number };
  token = { value: j.access_token, exp: Date.now() + Math.max(60, (j.expires_in ?? 3600) - 120) * 1000 };
  return token.value;
}

async function apiGet(path: string, params: Record<string, string>) {
  const qs = new URLSearchParams({ include: "images,author", "fields.image": "variants.landscape-crop,variants.square-small", "fields.user": "profile.displayName", ...params });
  const res = await fetch(`${API}${path}?${qs}`, { headers: { Authorization: `Bearer ${await anonToken()}`, Accept: "application/json" }, signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!res.ok) throw new Error(`listing query failed (HTTP ${res.status})`);
  return (await res.json()) as { data: ApiListing | ApiListing[]; included?: ApiIncluded[]; meta?: { totalItems: number; totalPages: number; page: number } };
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
    if (isRideClass(q.rideClass)) params.pub_rideClass = q.rideClass;
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

/** One live operator listing (for the request form prefill), or null. */
export async function getOperatorListing(id: string): Promise<OperatorCard | null> {
  if (!isListingId(id)) return null;
  try {
    const body = await apiGet("/listings/show", { id });
    return Array.isArray(body.data) ? null : toOperatorCard(body.data, body.included ?? [], null);
  } catch {
    return null;
  }
}

/** Book link on the Sharetribe marketplace (only rendered for bookable listings). */
export function marketplaceListingUrl(card: Pick<OperatorCard, "id" | "title">): string {
  const base = (process.env.SHARETRIBE_MARKETPLACE_URL || "https://carnivalrental-9ecfo8.mysharetribe-test.com").replace(/\/$/, "");
  const slug = card.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "ride";
  return `${base}/l/${slug}/${card.id}`;
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
