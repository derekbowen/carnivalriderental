/**
 * Listing images that are never shown: they read as no photo (the no-photo tile) wherever a listing
 * photo appears (inventory snapshot, live listing cards, the listing gallery).
 *
 * - Placeholder graphics, not photos of the ride: "Photo Coming Soon" cards, grey camera icons and a
 *   "COMING SOON" overlay that the photo import copied from operators' websites. Found 2026-11-04 by
 *   comparing every listing thumbnail with known placeholder graphics; the importer now rejects them
 *   (scripts/lib/image-tools.ts) and `npm run import:photos -- --recover` replaces them when the
 *   operator's site has a real photo.
 * - Images that identify the operator (locked data, CLAUDE.md): a flyer printing the operator's website.
 *
 * Keyed by the image id in the Sharetribe CDN path (sharetribe.imgix.net/{marketplace}/{image}?…), which
 * every size of the image shares.
 */
const PLACEHOLDERS = [
  "6acf3604-07e5-43c5-95e6-d04bed7ed9f5",
  "6acf3608-9f21-454d-a467-36696c66dbcc",
  "6acf379f-9aa4-4753-a23b-4fe2520fc10e",
  "6acf388e-4e34-4b3a-9c45-949bbdbf9ede",
  "6acf38ef-1da7-41a7-9647-8c9f144321bd",
  "6acf38f4-d438-4bfd-83ea-322af2f68bf2",
  "6acf38fa-8fe8-4854-ba03-9b250be9120c",
  "6acf3900-5c36-44bf-bbdf-cea9cd0a3214",
  "6acf3ae9-2e9b-45bc-9372-2d89d83f91bf",
  "6acf3ab7-09d2-4f44-a12c-b732f6c45a20",
  "6acf3ad1-bc2f-40be-9c30-d06f21b76823",
  "6acf3add-4b37-4efa-9593-f41d98ec33cf",
  "6acf3af0-87ee-4566-94da-2925fbba7170",
  "6acf3a37-b6e0-4e5f-aeaa-bfeffcb7085c",
  "6acf3a58-3b31-4214-ba86-8e1d286d2575",
  "6acf3a89-a463-42e3-be66-53911de9f66f",
  "6acf3801-184d-4cce-9f41-5511d726e313",
];

export const HIDDEN_IMAGES: ReadonlyMap<string, string> = new Map([
  ...PLACEHOLDERS.map((id) => [id, "placeholder graphic"] as const),
  ["6ad4af80-badb-4587-83e9-ae7a96cfbf76", "flyer printing the operator's website"],
]);

/** True when the URL is a Sharetribe CDN copy of a hidden image. */
export function isHiddenImage(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.host === "sharetribe.imgix.net" && HIDDEN_IMAGES.has(u.pathname.split("/")[2] ?? "");
  } catch {
    return false;
  }
}

/** True only for a placeholder graphic (photo recovery replaces these; identifying images it leaves alone). */
export function isPlaceholderImage(urlOrImageId: string): boolean {
  let id = urlOrImageId;
  try {
    const u = new URL(urlOrImageId);
    if (u.host !== "sharetribe.imgix.net") return false;
    id = u.pathname.split("/")[2] ?? "";
  } catch {
    // a bare image id
  }
  return HIDDEN_IMAGES.get(id) === "placeholder graphic";
}
