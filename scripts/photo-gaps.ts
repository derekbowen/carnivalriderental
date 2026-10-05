/**
 * Why each listing in the public snapshot has no photo (read-only; writes reports/photo-gaps.json).
 *   npm run photos:gaps
 * Joins rides.json with the photo import ledger and exceptions. Starts no download. Output holds
 * listing IDs and ride titles only, never company identifiers.
 */
import fs from "node:fs";
import { RIDES } from "../src/lib/inventory";

const DIR = "imports/photos/carnivalrental-test";
const ledger = fs.readFileSync(`${DIR}/ledger.jsonl`, "utf8").trim().split("\n").map((l) => JSON.parse(l) as { listingId: string; outcome: string });
const exceptions = JSON.parse(fs.readFileSync(`${DIR}/exceptions.json`, "utf8")) as { listingId: string; outcome: string; detail?: string }[];
const lastException = new Map(exceptions.map((e) => [e.listingId, e]));
const attempted = new Set(ledger.filter((e) => e.outcome !== "approved_without_photo").map((e) => e.listingId));

function reason(id: string): string {
  const e = lastException.get(id);
  if (e?.outcome === "bad_image") return "source URL did not return a usable image (HTML/bot-check page or unsupported format)";
  if (e?.outcome === "failed") {
    const code = /HTTP (\d{3})/.exec(e.detail ?? "")?.[1];
    if (code === "503") return "operator site returned HTTP 503 (temporarily unavailable or blocking) after retry";
    if (code === "404") return "photo URL no longer exists on the operator site (HTTP 404)";
    if (code === "403" || code === "406") return `operator site refused the download (HTTP ${code})`;
    return `download failed (${e.detail ?? "unknown"})`;
  }
  if (!attempted.has(id)) return "no operator-website photo in the source data (approved without photo)";
  return "unexplained: attempted with no recorded exception";
}

const missing = RIDES.filter((r) => !r.photo).map((r) => ({ id: r.id, title: r.title, reason: reason(r.id) }));
const counts: Record<string, number> = {};
for (const m of missing) counts[m.reason] = (counts[m.reason] ?? 0) + 1;
const out = { generatedFrom: ["src/lib/inventory/rides.json", `${DIR}/ledger.jsonl`, `${DIR}/exceptions.json`], withoutPhoto: missing.length, counts, listings: missing };
fs.mkdirSync("reports", { recursive: true });
fs.writeFileSync("reports/photo-gaps.json", `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({ withoutPhoto: out.withoutPhoto, counts }, null, 2));
