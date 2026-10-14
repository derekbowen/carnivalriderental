/**
 * Listing photos from operators' own websites (founder decision 2026-10-04: use them, remove on request).
 * Pure logic over an injected API; the CLI is scripts/photo-import.ts. Docs: docs/LISTING_IMPORT.md §Photos.
 *
 * Rules:
 * - One photo per listing: the ride's own image on the operator's site (privateData.sourceImageUrl).
 * - Never replaces images already on a listing (an operator's own uploads win), never touches a listing
 *   whose company has claimed its account, and skips companies on the takedown list.
 * - Every attached photo records its provenance (source URL, ride page, date, basis) in privateData
 *   and metadata.photoSource = "operator_website", so removal is one command.
 * - Downloads are checked: http(s) only, image/jpeg|png|gif by magic bytes, ≤ 20 MB (Sharetribe limit).
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
}

export interface PhotoApi {
  /** Current images count, metadata and author's claim status. */
  listingState(listingId: string): Promise<{ images: number; state: string; metadata: Record<string, unknown>; authorClaimStatus: unknown } | null>;
  /** Optional: re-encode an oversized image (e.g. ImageMagick → JPEG ≤ 2400 px). Returns null on failure. */
  shrink?(bytes: Uint8Array): Promise<Uint8Array | null>;
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
      if (state.images > 0) {
        // Resume: photo already attached (by an earlier run or the operator). Approve if still pending.
        if (d.approve && state.state === "pendingApproval") {
          await d.api.approve(it.listingId);
          await emit(it, { outcome: "approved" });
        } else await emit(it, { outcome: "already_has_images" });
        continue;
      }
      let { bytes } = await d.api.download(it.sourceUrl);
      if (bytes.byteLength > MAX_BYTES && d.api.shrink && sniffImage(bytes)) bytes = (await d.api.shrink(bytes)) ?? bytes;
      const type = sniffImage(bytes);
      if (!type || bytes.byteLength > MAX_BYTES) {
        await emit(it, { outcome: "bad_image", detail: !type ? "not a JPEG/PNG/GIF" : "over 20 MB" });
        continue;
      }
      const ext = type.split("/")[1].replace("jpeg", "jpg");
      const imageId = await d.api.upload(bytes, `${it.externalId}.${ext}`, type);
      await d.api.attach(it.listingId, imageId, { sourceUrl: it.sourceUrl, ridePage: it.ridePage, importedAt: d.now(), basis: PHOTO_BASIS });
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
