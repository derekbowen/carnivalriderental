/**
 * ImageMagick helpers for the photo importer (scripts/photo-import.ts). Each returns null when
 * ImageMagick is missing or the bytes are not an image, so callers fall back to their own checks.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const magick = (args: string[], input: Uint8Array): Buffer | null => {
  const r = spawnSync("convert", args, { input: Buffer.from(input), maxBuffer: 256 * 1024 * 1024 });
  return r.status === 0 && r.stdout.length > 0 ? r.stdout : null;
};

/** Any still image (first frame of an animation), upright, at most 2400 px, as JPEG. */
export function toJpeg(bytes: Uint8Array): Uint8Array | null {
  const out = magick(["-[0]", "-auto-orient", "-resize", "2400x2400>", "-quality", "85", "jpg:-"], bytes);
  return out ? new Uint8Array(out) : null;
}

/**
 * 12 × 8 RGB thumbnail of the image's centre, cropped to 3:2 the way listing cards crop it: a 288-byte
 * signature that is close for two copies of the same graphic, whatever their size or encoding.
 */
export function signature(bytes: Uint8Array): Uint8Array | null {
  const out = magick(["-[0]", "-resize", "300x200^", "-gravity", "center", "-extent", "300x200", "-resize", "12x8!", "-depth", "8", "rgb:-"], bytes);
  return out && out.length === 288 ? new Uint8Array(out) : null;
}

/** Distinct colours at 48 × 32 after posterizing: a flat graphic has a handful, a photo dozens. */
export function colourCount(bytes: Uint8Array): number | null {
  const out = magick(["-[0]", "-resize", "48x32!", "-posterize", "8", "-format", "%k", "info:-"], bytes);
  const n = out ? Number(out.toString().trim()) : NaN;
  return Number.isFinite(n) ? n : null;
}

const rmse = (a: Uint8Array, b: Uint8Array) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s / a.length);
};

const REFS_FILE = fileURLToPath(new URL("./placeholder-signatures.json", import.meta.url));
let refs: Uint8Array[] | null = null;
const references = () =>
  (refs ??= fs.existsSync(REFS_FILE) ? (JSON.parse(fs.readFileSync(REFS_FILE, "utf8")) as { signatures: string[] }).signatures.map((s) => new Uint8Array(Buffer.from(s, "base64"))) : []);

/**
 * True for a placeholder graphic rather than a photo of the ride: a flat image (≤ 4 colours, such as a
 * grey camera icon) or a close copy of a known placeholder (placeholder-signatures.json: "Photo Coming
 * Soon" cards, camera icons, a "COMING SOON" overlay). Calibrated 2026-11-04 on the 4,069 listing photos:
 * the camera icons have 2 colours, no real photo had fewer than 7, and every known placeholder is within
 * 10 of a reference while the nearest real photo is 26 away.
 */
export function isPlaceholderGraphic(bytes: Uint8Array): boolean {
  const colours = colourCount(bytes);
  if (colours !== null && colours <= 4) return true;
  const sig = signature(bytes);
  return !!sig && references().some((r) => rmse(sig, r) < 15);
}
