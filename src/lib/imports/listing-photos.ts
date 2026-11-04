/**
 * Listing photos from operators' own websites (founder decision 2026-10-04: use them, remove on request).
 * Pure logic over an injected API; the CLI is scripts/photo-import.ts. Docs: docs/LISTING_IMPORT.md §Photo recovery.
 *
 * Rules:
 * - One photo per listing: the ride's own image on the operator's site (privateData.sourceImageUrl).
 * - Never replaces images already on a listing (an operator's own uploads win), never touches a listing
 *   whose company has claimed its account, and skips companies on the takedown list.
 * - Every attached photo records its provenance (source URL, ride page, date, basis) in privateData
 *   and metadata.photoSource = "operator_website", so removal is one command.
 * - Downloads are checked: http(s) only, image/jpeg|png|gif by magic bytes (WebP, AVIF/HEIC, BMP and TIFF
 *   are converted to JPEG first), ≤ 20 MB (Sharetribe limit), and never a placeholder graphic ("photo
 *   coming soon", a camera icon), by file name or by look.
 * - Recovery (2026-11-04): listings published without a photo, or with a placeholder this importer added,
 *   are planned straight from Live (planRecovery). A ride with no recorded photo can get one found on its
 *   own ride page (discoverRideImage), used only after review.
 */
import type { ListingMapping } from "./operator-listings";

export const PHOTO_BASIS = "founder decision 2026-10-05: operator website photo; removed on request";
export const MAX_BYTES = 20 * 1024 * 1024;

export interface PhotoItem {
  externalId: string;
  companyId: string;
  listingId: string;
  sourceUrl: string;
  ridePage: string | null;
  /**
   * Live migration: download this already-hosted copy (the Test listing's image) instead of fetching the
   * operator's site again. Provenance still records sourceUrl/ridePage, plus where the copy came from.
   */
  copyFrom?: { url: string; note: string };
  /** The listing's current image is a placeholder this importer added: replace it (never an operator's upload). */
  replace?: boolean;
  /** How the photo was found when it is not the recorded source photo (kept in the provenance). */
  foundOn?: string;
}

export interface PhotoApi {
  /** Current images count, metadata and author's claim status. */
  listingState(listingId: string): Promise<{ images: number; state: string; metadata: Record<string, unknown>; authorClaimStatus: unknown } | null>;
  /** Optional: re-encode an oversized image (e.g. ImageMagick → JPEG ≤ 2400 px). Returns null on failure. */
  shrink?(bytes: Uint8Array): Promise<Uint8Array | null>;
  /** Optional: re-encode a WebP, AVIF/HEIC, BMP or TIFF image as JPEG. Returns null on failure. */
  toJpeg?(bytes: Uint8Array): Promise<Uint8Array | null>;
  /** Optional: true when the image is a placeholder graphic, not a photo of the ride. */
  isPlaceholder?(bytes: Uint8Array): Promise<boolean>;
  /** Integration API listings/approve (pendingApproval → published). */
  approve(listingId: string): Promise<void>;
  download(url: string): Promise<{ bytes: Uint8Array; contentType: string }>;
  upload(bytes: Uint8Array, filename: string, contentType: string): Promise<string>;
  attach(listingId: string, imageId: string, provenance: Record<string, unknown>): Promise<void>;
}

export type PhotoOutcome = "attached" | "attached_approved" | "approved" | "already_has_images" | "skipped_takedown" | "skipped_claimed" | "bad_image" | "failed";

export interface PhotoLedgerEntry {
  at: string;
  runId: string;
  externalId: string;
  companyId: string;
  listingId: string;
  outcome: PhotoOutcome;
  imageId?: string;
  detail?: string;
}

export function planPhotos(
  rows: { externalId: string; metadata: { companyId: string }; privateData: { sourceImageUrl?: string; sourceRidePage?: string } }[],
  mapping: ListingMapping,
): { items: PhotoItem[]; noPhoto: number; notCreated: number } {
  const items: PhotoItem[] = [];
  let noPhoto = 0;
  let notCreated = 0;
  for (const r of rows) {
    const url = r.privateData.sourceImageUrl;
    if (!url || !/^https?:\/\//i.test(url)) {
      noPhoto++;
      continue;
    }
    const m = mapping[r.externalId];
    if (!m) {
      notCreated++;
      continue;
    }
    items.push({ externalId: r.externalId, companyId: r.metadata.companyId, listingId: m.listingId, sourceUrl: url, ridePage: r.privateData.sourceRidePage ?? null });
  }
  return { items, noPhoto, notCreated };
}

/** A file name that says it stands in for a photo: "photo-coming-soon.jpg", "no-image.png", "placeholder.gif". */
const PLACEHOLDER_NAME = /(place-?holder|coming[-_ ]?soon|no[-_ ]?(image|photo|picture|pic|img)|image[-_ ]?(not[-_ ]?)?(available|unavailable)|default[-_ ]?(image|photo|thumb)|missing[-_ ]?(image|photo))/i;
export function looksLikePlaceholderUrl(url: string): boolean {
  try {
    return PLACEHOLDER_NAME.test(decodeURIComponent(new URL(url).pathname));
  } catch {
    return false;
  }
}

/** Image formats that are not uploaded as they are but convert to JPEG: WebP, AVIF/HEIC, BMP, TIFF. */
export function isConvertibleImage(b: Uint8Array): boolean {
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (b.length > 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return true;
  if (b.length > 12 && ascii(4, 8) === "ftyp" && /^(avif|avis|heic|heix|mif1|msf1)$/.test(ascii(8, 12))) return true;
  if (b.length > 14 && ascii(0, 2) === "BM") return true;
  return b.length > 4 && ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0) || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0 && b[3] === 0x2a));
}

/** Image type from magic bytes; null when it isn't a JPEG, PNG or GIF. */
export function sniffImage(b: Uint8Array): "image/jpeg" | "image/png" | "image/gif" | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length > 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  return null;
}

export async function runPhotoImport(
  items: PhotoItem[],
  d: { api: PhotoApi; takedowns: Set<string>; now(): string; runId: string; onResult(e: PhotoLedgerEntry): Promise<void> | void; approve?: boolean; concurrency?: number },
): Promise<PhotoLedgerEntry[]> {
  // Companies run in parallel (different websites); one company's rides run in order, so each
  // operator's site sees one request at a time. Sharetribe's rate limit is enforced by the client.
  const groups = new Map<string, PhotoItem[]>();
  for (const it of items) groups.set(it.companyId, [...(groups.get(it.companyId) ?? []), it]);
  const queue = [...groups.values()];
  const all: PhotoLedgerEntry[] = [];
  const worker = async () => {
    for (let g = queue.shift(); g; g = queue.shift()) all.push(...(await runSequential(g, d)));
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(d.concurrency ?? 1, 6)) }, worker));
  return all;
}

async function runSequential(
  items: PhotoItem[],
  d: { api: PhotoApi; takedowns: Set<string>; now(): string; runId: string; onResult(e: PhotoLedgerEntry): Promise<void> | void; approve?: boolean },
): Promise<PhotoLedgerEntry[]> {
  const out: PhotoLedgerEntry[] = [];
  const emit = async (it: PhotoItem, e: Pick<PhotoLedgerEntry, "outcome" | "imageId" | "detail">) => {
    const entry: PhotoLedgerEntry = { at: d.now(), runId: d.runId, externalId: it.externalId, companyId: it.companyId, listingId: it.listingId, ...e };
    out.push(entry);
    await d.onResult(entry);
  };
  for (const it of items) {
    try {
      if (d.takedowns.has(it.companyId)) {
        await emit(it, { outcome: "skipped_takedown" });
        continue;
      }
      const state = await d.api.listingState(it.listingId);
      if (!state) {
        await emit(it, { outcome: "failed", detail: "listing not found" });
        continue;
      }
      if (state.authorClaimStatus !== "unclaimed") {
        await emit(it, { outcome: "skipped_claimed", detail: `author claimStatus=${String(state.authorClaimStatus)}` });
        continue;
      }
      // A placeholder this importer added (metadata.photoSource) can be replaced; an operator's own upload never.
      const replacing = !!it.replace && state.images > 0 && state.metadata.photoSource === "operator_website";
      if (state.images > 0 && !replacing) {
        // Resume: photo already attached (by an earlier run or the operator). Approve if still pending.
        if (d.approve && state.state === "pendingApproval") {
          await d.api.approve(it.listingId);
          await emit(it, { outcome: "approved" });
        } else await emit(it, { outcome: "already_has_images" });
        continue;
      }
      if (looksLikePlaceholderUrl(it.sourceUrl)) {
        await emit(it, { outcome: "bad_image", detail: "placeholder graphic (file name)" });
        continue;
      }
      let { bytes } = await d.api.download(it.copyFrom?.url ?? it.sourceUrl);
      if (!sniffImage(bytes) && isConvertibleImage(bytes) && d.api.toJpeg) bytes = (await d.api.toJpeg(bytes)) ?? bytes;
      if (bytes.byteLength > MAX_BYTES && d.api.shrink && sniffImage(bytes)) bytes = (await d.api.shrink(bytes)) ?? bytes;
      const type = sniffImage(bytes);
      if (!type || bytes.byteLength > MAX_BYTES) {
        await emit(it, { outcome: "bad_image", detail: !type ? "not a JPEG/PNG/GIF" : "over 20 MB" });
        continue;
      }
      if (d.api.isPlaceholder && (await d.api.isPlaceholder(bytes))) {
        await emit(it, { outcome: "bad_image", detail: "placeholder graphic" });
        continue;
      }
      const ext = type.split("/")[1].replace("jpeg", "jpg");
      const imageId = await d.api.upload(bytes, `${it.externalId}.${ext}`, type);
      await d.api.attach(it.listingId, imageId, { sourceUrl: it.sourceUrl, ridePage: it.ridePage, importedAt: d.now(), basis: PHOTO_BASIS, ...(it.copyFrom ? { copiedFrom: it.copyFrom.note } : {}), ...(it.foundOn ? { foundOn: it.foundOn } : {}), ...(replacing ? { replaced: "placeholder graphic" } : {}) });
      if (d.approve && state.state === "pendingApproval") {
        await d.api.approve(it.listingId);
        await emit(it, { outcome: "attached_approved", imageId });
      } else await emit(it, { outcome: "attached", imageId });
    } catch (e) {
      await emit(it, { outcome: "failed", detail: String((e as Error).message).slice(0, 300) });
    }
  }
  return out;
}

/** A listing as the Integration API returns it, reduced to what photo recovery needs. */
export interface LiveListing {
  id: string;
  title: string;
  state: string;
  /** One URL per attached image (any variant), in order. */
  imageUrls: string[];
  privateData: { importExternalId?: unknown; companyId?: unknown; sourceImageUrl?: unknown; sourceRidePage?: unknown };
}

/** A ride with no recorded photo whose own ride page can be searched for one (discoverRideImage). */
export interface DiscoverTarget {
  externalId: string;
  companyId: string;
  listingId: string;
  title: string;
  ridePage: string;
  replace: boolean;
}

const httpUrl = (v: unknown): string | null => (typeof v === "string" && /^https?:\/\//i.test(v) ? v : null);

/**
 * Photo recovery, planned straight from Live (no workbook or mapping): every imported listing that is
 * published or pending approval and shows no photo, because it has no image or only placeholders.
 * Its recorded source photo is retried; without one, its ride page is searched (after review).
 * Listings an operator created themselves (no import id in privateData) are never touched.
 */
export function planRecovery(listings: LiveListing[], isPlaceholderUrl: (url: string) => boolean): { items: PhotoItem[]; discover: DiscoverTarget[]; counts: Record<string, number> } {
  const items: PhotoItem[] = [];
  const discover: DiscoverTarget[] = [];
  const counts: Record<string, number> = {};
  const tally = (k: string) => (counts[k] = (counts[k] ?? 0) + 1);
  for (const l of listings) {
    if (l.state !== "published" && l.state !== "pendingApproval") continue;
    const placeholder = l.imageUrls.length > 0 && l.imageUrls.every(isPlaceholderUrl);
    if (l.imageUrls.length > 0 && !placeholder) continue;
    const externalId = typeof l.privateData.importExternalId === "string" ? l.privateData.importExternalId : null;
    const companyId = typeof l.privateData.companyId === "string" ? l.privateData.companyId : null;
    if (!externalId || !companyId) {
      tally("not an imported listing (never touched)");
      continue;
    }
    const source = httpUrl(l.privateData.sourceImageUrl);
    const ridePage = httpUrl(l.privateData.sourceRidePage);
    if (source && !looksLikePlaceholderUrl(source)) {
      items.push({ externalId, companyId, listingId: l.id, sourceUrl: source, ridePage, replace: placeholder });
      tally(placeholder ? "placeholder: retry the source photo" : "no photo: retry the source photo");
    } else if (ridePage) {
      discover.push({ externalId, companyId, listingId: l.id, title: l.title, ridePage, replace: placeholder });
      tally(placeholder ? "placeholder: search the ride page" : "no photo: search the ride page");
    } else tally("no source photo and no ride page");
  }
  return { items, discover, counts };
}

/** Words in a ride title that don't tell rides apart. */
const GENERIC = new Set(["ride", "rides", "rental", "rentals", "the", "a", "an", "and", "of", "for", "with", "new", "ft", "foot", "feet", "seat", "seats", "seater", "person", "passenger", "attraction", "amusement", "carnival", "x"]);

/** Lowercase title words that identify the ride ("Ferris Wheel 20 ft" → ferris, wheel, 20). */
export function rideTokens(title: string): string[] {
  return [...new Set(title.toLowerCase().replace(/['’]/g, "").split(/[^a-z0-9]+/).filter((t) => t.length > 1 && !GENERIC.has(t)))];
}

/** Images that are never a photo of a ride: site furniture, social icons, payment marks. */
const NOT_A_RIDE = /(logo|icon|favicon|sprite|badge|avatar|button|arrow|banner[-_]?ad|facebook|instagram|twitter|youtube|pinterest|tiktok|linkedin|yelp|tripadvisor|google|paypal|visa|mastercard|amex|discover-card|map|marker|spinner|loader|pixel|tracking)/i;

const attr = (tag: string, name: string): string | null => {
  const m = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return m ? (m[2] ?? m[3] ?? m[4] ?? "").trim() : null;
};
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const resolve = (src: string, base: string): string | null => {
  try {
    const u = new URL(decode(src), base);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
};
/** The widest candidate of a srcset ("a.jpg 300w, b.jpg 1200w" → b.jpg). */
const largestFromSrcset = (srcset: string): string | null =>
  srcset
    .split(",")
    .map((s) => s.trim().split(/\s+/))
    .filter((p) => p[0])
    .map((p) => ({ url: p[0], w: Number.parseFloat(p[1] ?? "0") || 0 }))
    .sort((a, b) => b.w - a.w)[0]?.url ?? null;
const words = (s: string) => decode(s).toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ");
const hasToken = (text: string, t: string) => new RegExp(`(^|\\s)${t}`).test(text);

/**
 * The ride's own photo on its ride page, or null. Conservative: an <img> counts only when its alt text,
 * title or file name names at least half of the ride's distinguishing words (rideTokens), and the best
 * match wins (ties go to the larger declared width, then page order). The page's og:image is used only
 * when the page itself is about the ride (its address names the ride) and no image matched. Logos,
 * icons, SVGs, tiny images and placeholder file names are never candidates.
 */
export function discoverRideImage(html: string, pageUrl: string, title: string): { url: string; matched: string[]; how: "img" | "og:image" } | null {
  const tokens = rideTokens(title);
  if (!tokens.length) return null;
  const usable = (url: string) => {
    const path = decodeURIComponent(new URL(url).pathname);
    return !/\.svg$/i.test(path) && !NOT_A_RIDE.test(path) && !looksLikePlaceholderUrl(url);
  };
  const candidates: { url: string; matched: string[]; width: number; order: number }[] = [];
  let order = 0;
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const raw = attr(tag, "data-src") ?? attr(tag, "data-lazy-src") ?? (attr(tag, "srcset") ? largestFromSrcset(attr(tag, "srcset")!) : null) ?? attr(tag, "src");
    const url = raw && !raw.startsWith("data:") ? resolve(raw, pageUrl) : null;
    if (!url || !usable(url)) continue;
    const width = Number(attr(tag, "width") ?? 0) || 0;
    const height = Number(attr(tag, "height") ?? 0) || 0;
    if ((width && width < 150) || (height && height < 100)) continue;
    const text = words(`${attr(tag, "alt") ?? ""} ${attr(tag, "title") ?? ""} ${decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "")}`);
    const matched = tokens.filter((t) => hasToken(text, t));
    if (matched.length * 2 >= tokens.length) candidates.push({ url, matched, width, order: order++ });
  }
  candidates.sort((a, b) => b.matched.length - a.matched.length || b.width - a.width || a.order - b.order);
  if (candidates[0]) return { url: candidates[0].url, matched: candidates[0].matched, how: "img" };
  const pageWords = words(decodeURIComponent(new URL(pageUrl).pathname));
  const pageMatched = tokens.filter((t) => hasToken(pageWords, t));
  if (pageMatched.length * 2 < tokens.length) return null;
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const prop = (attr(m[0], "property") ?? attr(m[0], "name") ?? "").toLowerCase();
    if (prop !== "og:image" && prop !== "twitter:image") continue;
    const url = resolve(attr(m[0], "content") ?? "", pageUrl);
    if (url && usable(url)) return { url, matched: pageMatched, how: "og:image" };
  }
  return null;
}
