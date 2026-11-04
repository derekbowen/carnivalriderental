/**
 * Attach each imported listing's photo from the operator's own website (founder decision 2026-10-04).
 *
 *   npm run import:photos                                   # dry run: counts only
 *   npm run import:photos -- --apply --only a-and-a-attractions--berry-go-round
 *   npm run import:photos -- --apply                        # every created listing with a source photo
 *   npm run import:photos -- --remove acme-shows            # takedown: strip that company's imported photos
 *                                                           # and add it to imports/photos/takedowns.json
 *   npm run import:photos -- --apply --approve --from-source --founder-go --target live --confirm-live "CarnivalRental"
 *                                                           # gap-audit rides (no Test copy): fetch from the operator's page
 *
 * Recovery (2026-11-04): listings that show no photo (none attached, or a placeholder graphic this importer
 * added), read straight from Live — no workbook or mapping needed. Docs: docs/LISTING_IMPORT.md §Photo recovery.
 *   npm run import:photos -- --recover --target live --confirm-live "CarnivalRental"               # dry run: what is missing and why
 *   npm run import:photos -- --recover --discover --target live --confirm-live "CarnivalRental"    # search ride pages → discovered.json + contact sheets
 *   npm run import:photos -- --recover --approve-discovered all|id,…  [--reject-discovered id,…]   # record the review
 *   npm run import:photos -- --recover --apply --founder-go [--use-discovered] --target live --confirm-live "CarnivalRental"
 * Options: --company id1,id2  --only externalId1,…  --limit N
 */
import "./lib/target-env"; // must stay first: `--target live` selects the SHARETRIBE_LIVE_* credentials
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { planListings } from "../src/lib/imports/operator-listings";
import { isPlaceholderImage } from "../src/lib/catalog/hidden-images";
import { discoverRideImage, planPhotos, planRecovery, runPhotoImport, type DiscoverTarget, type LiveListing, type PhotoApi, type PhotoItem, type PhotoLedgerEntry } from "../src/lib/imports/listing-photos";
import { isPlaceholderGraphic, toJpeg } from "./lib/image-tools";
import { redact } from "../src/lib/imports/company-accounts";
import { writeJsonAtomic } from "./lib/files";
import { HttpError, INTEG, TEST_MARKETPLACE, createClient } from "./lib/sharetribe-client";

const argv = process.argv.slice(2);
const opt = (n: string) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const list = (n: string) => opt(n)?.split(",").map((s) => s.trim()).filter(Boolean);
const apply = argv.includes("--apply");
const approve = argv.includes("--approve");
const removeCompany = opt("remove");
const target = (opt("target") ?? "test") as "test" | "live";
const DIR = "imports/photos";
const TAKEDOWNS = `${DIR}/takedowns.json`;
const { call, headers, marketplaceNames } = createClient(target);

// Polite downloads: one request per operator website per 2.5 s, identified, bounded. Sharetribe's own
// image CDN (the Live migration copies Test's hosted images) is not an operator's site and is not throttled.
const lastHit = new Map<string, number>();
const SHARETRIBE_CDN = "sharetribe.imgix.net";
async function download(url: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const host = new URL(url).host;
  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const wait = host === SHARETRIBE_CDN ? 0 : (lastHit.get(host) ?? 0) + 2500 - Date.now(); // ≤ 1 request / 2.5 s per website
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastHit.set(host, Date.now());
    // Only JPEG/PNG/GIF are accepted downstream; ask for them so format-negotiating CDNs don't send WebP/AVIF.
    res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(30000), headers: { "User-Agent": "CarnivalRideRental-ListingPhotos/1.0 (+https://carnivalriderental.us)", Accept: "image/jpeg, image/png;q=0.9, image/gif;q=0.8" } });
    if (res.status !== 429 && res.status !== 503) break;
    await new Promise((r) => setTimeout(r, 10000 * (attempt + 1))); // the site asked us to slow down
  }
  if (!res || !res.ok) throw new Error(`download HTTP ${res?.status}`);
  const len = Number(res.headers.get("content-length") ?? 0);
  // Operator sites: 60 MB. Sharetribe's CDN copy of an already-hosted image can be larger (one animated
  // GIF is 100 MB as served) and is shrunk to a first-frame JPEG before upload; still bounded.
  const cap = host === SHARETRIBE_CDN ? 150 : 60;
  if (len > cap * 1024 * 1024) throw new Error(`download over ${cap} MB`);
  return { bytes: new Uint8Array(await res.arrayBuffer()), contentType: res.headers.get("content-type") ?? "" };
}

type ListingShow = {
  data: { attributes: { state?: string; metadata?: Record<string, unknown> }; relationships?: { images?: { data: unknown[] }; author?: { data: { id: string } } } };
  included?: { id: string; type: string; attributes: { profile?: { metadata?: Record<string, unknown> } } }[];
};

const api: PhotoApi = {
  async listingState(id) {
    try {
      const r = await call<ListingShow>("query", `${INTEG}/listings/show?${new URLSearchParams({ id, include: "images,author" })}`, { headers: await headers("integ") }, true);
      const authorId = r.data.relationships?.author?.data.id;
      const author = r.included?.find((x) => x.type === "user" && x.id === authorId);
      return { images: r.data.relationships?.images?.data.length ?? 0, state: r.data.attributes.state ?? "unknown", metadata: r.data.attributes.metadata ?? {}, authorClaimStatus: author?.attributes.profile?.metadata?.claimStatus };
    } catch (e) {
      if (e instanceof HttpError && e.status === 404) return null;
      throw e;
    }
  },
  download,
  async shrink(bytes) {
    // "-[0]": first frame only. An animated GIF would otherwise become one JPEG per frame (a 100 MB GIF
    // came back as 120 MB of JPEGs); a listing photo is a still.
    const r = spawnSync("convert", ["-[0]", "-resize", "2400x2400>", "-quality", "85", "jpg:-"], { input: Buffer.from(bytes), maxBuffer: 256 * 1024 * 1024 });
    return r.status === 0 && r.stdout.length > 0 ? new Uint8Array(r.stdout) : null;
  },
  async toJpeg(bytes) {
    return toJpeg(bytes);
  },
  async isPlaceholder(bytes) {
    return isPlaceholderGraphic(bytes);
  },
  async upload(bytes, filename, contentType) {
    const form = new FormData();
    form.append("image", new Blob([new Uint8Array(bytes)], { type: contentType }), filename);
    const r = await call<{ data: { id: string } }>("command", `${INTEG}/images/upload`, { method: "POST", headers: await headers("integ"), body: form }, false);
    return r.data.id;
  },
  async approve(listingId) {
    await call("command", `${INTEG}/listings/approve`, { method: "POST", headers: await headers("integ", true), body: JSON.stringify({ id: listingId }) }, true);
  },
  async attach(listingId, imageId, provenance) {
    await call("command", `${INTEG}/listings/update`, { method: "POST", headers: await headers("integ", true), body: JSON.stringify({ id: listingId, images: [imageId], privateData: { photoSource: provenance }, metadata: { photoSource: "operator_website" } }) }, true);
  },
};

// ── Recovery (2026-11-04): listings that show no photo, read straight from Live ─────────────────────

type QueryListing = { id: string; attributes: { title?: string; state?: string; privateData?: LiveListing["privateData"] }; relationships?: { images?: { data?: { id: string }[] } } };
type QueryImage = { id: string; type: string; attributes?: { variants?: Record<string, { url?: string } | null> } };

/** Every listing on the marketplace with its images' URLs (Integration API: privateData included). */
async function liveListings(): Promise<LiveListing[]> {
  const out: LiveListing[] = [];
  for (let page = 1; ; page++) {
    const qs = new URLSearchParams({ perPage: "100", page: String(page), include: "images", "fields.image": "variants.square-small" });
    const r = await call<{ data: QueryListing[]; included?: QueryImage[]; meta: { totalPages: number } }>("query", `${INTEG}/listings/query?${qs}`, { headers: await headers("integ") }, true);
    const images = new Map((r.included ?? []).filter((i) => i.type === "image").map((i) => [i.id, i]));
    for (const l of r.data) {
      const ids = (l.relationships?.images?.data ?? []).map((x) => x.id);
      // The CDN URL carries the image id; without a variant URL the bare id still identifies it.
      out.push({ id: l.id, title: l.attributes.title ?? "", state: l.attributes.state ?? "unknown", imageUrls: ids.map((id) => images.get(id)?.attributes?.variants?.["square-small"]?.url ?? id), privateData: l.attributes.privateData ?? {} });
    }
    if (page >= (r.meta.totalPages ?? 1)) break;
  }
  return out;
}

/** A ride page's HTML, politely (same per-site pacing as photo downloads), at most 5 MB. */
async function fetchPage(url: string): Promise<string | null> {
  const host = new URL(url).host;
  const wait = (lastHit.get(host) ?? 0) + 2500 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastHit.set(host, Date.now());
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(30000), headers: { "User-Agent": "CarnivalRideRental-ListingPhotos/1.0 (+https://carnivalriderental.us)", Accept: "text/html" } });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html") || Number(res.headers.get("content-length") ?? 0) > 5 * 1024 * 1024) return null;
    return await res.text();
  } catch {
    return null;
  }
}

interface Discovered extends DiscoverTarget {
  imageUrl: string;
  matched: string[];
  how: "img" | "og:image";
  foundAt: string;
  /** null until reviewed: is this the ride's own photo? */
  approved: boolean | null;
}

async function recover(slug: string, ledgerFile: string, takedowns: Set<string>) {
  const isPlaceholderUrl = (u: string) => isPlaceholderImage(u);
  const listings = await liveListings();
  const plan = planRecovery(listings, isPlaceholderUrl);
  const keep = (x: { companyId: string; externalId: string }) => !takedowns.has(x.companyId) && (!list("company") || list("company")!.includes(x.companyId)) && (!list("only") || list("only")!.includes(x.externalId));
  const items: PhotoItem[] = plan.items.filter(keep);
  const targets = plan.discover.filter(keep);
  console.log(`Recovery: ${listings.length} listings on ${slug}. ${JSON.stringify(plan.counts)}`);

  const discoveredFile = `${DIR}/${slug}/discovered.json`; // gitignored with the rest of the Live folder: operator URLs
  const sheetsDir = `${DIR}/${slug}/discovered`;
  const previous: Discovered[] = fs.existsSync(discoveredFile) ? JSON.parse(fs.readFileSync(discoveredFile, "utf8")).discovered : [];

  if (argv.includes("--approve-discovered") || argv.includes("--reject-discovered")) {
    const yes = list("approve-discovered") ?? [];
    const no = new Set(list("reject-discovered") ?? []);
    for (const d of previous) {
      if (no.has(d.listingId)) d.approved = false;
      else if (yes.includes("all") ? d.approved === null : yes.includes(d.listingId)) d.approved = true;
    }
    writeJsonAtomic(discoveredFile, { generatedAt: new Date().toISOString(), discovered: previous });
    const t = previous.reduce<Record<string, number>>((a, d) => ((a[String(d.approved)] = (a[String(d.approved)] ?? 0) + 1), a), {});
    return console.log(`Review recorded: ${JSON.stringify(t)} (true = use, false = reject, null = not reviewed) → ${discoveredFile}`);
  }

  if (argv.includes("--discover")) {
    const limit = Number(opt("limit") ?? Infinity);
    const found: Discovered[] = [];
    let searched = 0;
    fs.mkdirSync(sheetsDir, { recursive: true });
    for (const t of targets.slice(0, limit)) {
      searched++;
      const html = await fetchPage(t.ridePage);
      const hit = html ? discoverRideImage(html, t.ridePage, t.title) : null;
      if (!hit) continue;
      // Download now so the reviewer sees the picture, and placeholders never reach review.
      let bytes: Uint8Array | null = null;
      try {
        bytes = (await download(hit.url)).bytes;
      } catch {
        continue;
      }
      const jpeg = toJpeg(bytes);
      if (!jpeg || isPlaceholderGraphic(jpeg)) continue;
      fs.writeFileSync(`${sheetsDir}/${t.listingId}.jpg`, jpeg);
      const before = previous.find((p) => p.listingId === t.listingId && p.imageUrl === hit.url);
      found.push({ ...t, imageUrl: hit.url, matched: hit.matched, how: hit.how, foundAt: new Date().toISOString(), approved: before?.approved ?? null });
      console.log(`  found  ${t.title.padEnd(36)} ${hit.how} [${hit.matched.join(" ")}]`);
    }
    writeJsonAtomic(discoveredFile, { generatedAt: new Date().toISOString(), discovered: found });
    // Contact sheets for review: 24 per sheet, each labelled with the ride title and the listing id's start.
    for (let i = 0; i < found.length; i += 24) {
      const batch = found.slice(i, i + 24);
      const args = batch.flatMap((d) => ["-label", `${d.title.slice(0, 28)}\n${d.listingId.slice(0, 8)}`, `${sheetsDir}/${d.listingId}.jpg`]);
      spawnSync("montage", [...args, "-tile", "6x4", "-geometry", "220x147+4+18", "-pointsize", "11", `${sheetsDir}/sheet-${i / 24 + 1}.jpg`]);
    }
    console.log(`\nSearched ${searched} ride pages; found ${found.length} candidate photos → ${discoveredFile}, contact sheets in ${sheetsDir}/.`);
    return console.log("Review each sheet: is it this ride (not another ride, a logo or a flyer naming the operator)? Then --approve-discovered all --reject-discovered id,…");
  }

  if (argv.includes("--use-discovered")) {
    for (const d of previous.filter((x) => x.approved === true && keep(x))) {
      items.push({ externalId: d.externalId, companyId: d.companyId, listingId: d.listingId, sourceUrl: d.imageUrl, ridePage: d.ridePage, replace: d.replace, foundOn: `ride page ${d.how}, matched "${d.matched.join(" ")}", reviewed before upload` });
    }
  }
  const selected = items.slice(0, Number(opt("limit") ?? Infinity));
  console.log(`Selected ${selected.length} photos to upload (${selected.filter((i) => i.foundOn).length} found on ride pages); ${targets.length} rides without a recorded photo have a ride page to search (--discover).`);
  if (!apply) return console.log("DRY RUN — nothing uploaded.");
  if (target !== "test" && !argv.includes("--founder-go")) throw new Error("Refusing: --recover --apply on Live needs --founder-go.");
  const runId = `recover-${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomBytes(3).toString("hex")}`;
  const results = await runPhotoImport(selected, {
    api,
    approve,
    concurrency: Number(opt("concurrency") ?? 3),
    takedowns,
    now: () => new Date().toISOString(),
    runId,
    onResult(e: PhotoLedgerEntry) {
      const line = { ...e, detail: e.detail ? redact(e.detail) : undefined };
      fs.appendFileSync(ledgerFile, `${JSON.stringify(line)}\n`);
      if (e.outcome !== "already_has_images") console.log(`  ${e.outcome.padEnd(18)} ${e.externalId.padEnd(52)} ${e.imageId ?? ""}${e.detail ? `  ${line.detail}` : ""}`);
    },
  });
  const tally: Record<string, number> = {};
  for (const r of results) tally[r.outcome] = (tally[r.outcome] ?? 0) + 1;
  console.log(`\nResult: ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(", ")}\nLedger: ${ledgerFile}\nThen refresh the snapshot: npm run inventory:export -- --target live`);
}

(async () => {
  const names = await marketplaceNames();
  if (names.integ !== names.mkt) throw new Error("Refusing: API clients point at different marketplaces.");
  if (target === "test" && names.integ !== TEST_MARKETPLACE) throw new Error(`Refusing: --target test but marketplace is "${names.integ}".`);
  if (target === "live" && opt("confirm-live") !== names.integ) throw new Error(`Refusing: pass --confirm-live "${names.integ}".`);
  const slug = names.integ.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const takedowns: { companyId: string; at: string }[] = fs.existsSync(TAKEDOWNS) ? JSON.parse(fs.readFileSync(TAKEDOWNS, "utf8")).takedowns : [];
  const ledgerFile = `${DIR}/${slug}/ledger.jsonl`;
  fs.mkdirSync(path.dirname(ledgerFile), { recursive: true });
  if (argv.includes("--recover")) return recover(slug, ledgerFile, new Set(takedowns.map((t) => t.companyId)));
  const wb = JSON.parse(fs.readFileSync("imports/company-accounts/source/workbook.json", "utf8"));
  const mapping = JSON.parse(fs.readFileSync(`imports/listings/${slug}/mapping.json`, "utf8")).listings;

  const plan = planListings(wb);
  let { items, noPhoto, notCreated } = planPhotos(plan.rows, mapping);
  // Live: copy each photo from its Test listing's hosted image; operator sites are not fetched again.
  const fromTest = opt("from-test");
  // Gap-audit rides (founder go 2026-10-18: "with photos") never existed in Test: --from-source fetches
  // their photo from the operator's own page, and only for those rows (workbook source.gapAudit.listingIds).
  const fromSource = argv.includes("--from-source");
  if (fromSource && fromTest) throw new Error("Refusing: pass --from-test or --from-source, not both.");
  if (target === "live" && apply && !fromTest && !fromSource && !argv.includes("--approve-remaining")) throw new Error("Refusing: Live photos are copied from Test (--from-test imports/migration/test-public.json), or fetched from the operator's page for gap-audit rides (--from-source).");
  if (fromSource) {
    if (target !== "test" && apply && !argv.includes("--founder-go")) throw new Error("Refusing: --from-source on Live needs --founder-go (founder go 2026-10-18 for the gap-audit photos).");
    const ids = new Set<string>((wb.source?.gapAudit?.listingIds as string[] | undefined) ?? []);
    if (!ids.size) throw new Error("Refusing: the workbook has no gap-audit rows (run npm run import:gap-audit first).");
    items = items.filter((it) => ids.has(it.externalId));
    console.log(`From source: ${items.length} gap-audit listings have a source photo on the operator's page.`);
  }
  if (fromTest) {
    const snap = JSON.parse(fs.readFileSync(fromTest, "utf8")) as { marketplace: string; listings: { id: string; metadata: Record<string, unknown>; images: { url: string | null }[] }[] };
    if (snap.marketplace !== TEST_MARKETPLACE) throw new Error(`Refusing: ${fromTest} is not a ${TEST_MARKETPLACE} snapshot.`);
    const byExt = new Map(snap.listings.filter((l) => typeof l.metadata.importExternalId === "string").map((l) => [l.metadata.importExternalId as string, l]));
    const gaps: { externalId: string; listingId: string; reason: string }[] = [];
    items = items.flatMap((it) => {
      const t = byExt.get(it.externalId);
      const url = t?.images.find((i) => i.url)?.url;
      if (!t || !url) {
        gaps.push({ externalId: it.externalId, listingId: it.listingId, reason: t ? "the Test listing has no photo (source photo failed or was rejected in Test)" : "not in the Test snapshot" });
        return [];
      }
      return [{ ...it, copyFrom: { url, note: `Test listing ${t.id} image, copied ${new Date().toISOString().slice(0, 10)}` } }];
    });
    writeJsonAtomic(`${DIR}/${slug}/gaps.json`, { generatedAt: new Date().toISOString(), ridesWithoutSourcePhoto: noPhoto, gaps });
    console.log(`From Test: ${items.length} listings have a hosted Test photo to copy; ${gaps.length} gaps (+${noPhoto} rides with no source photo) → ${DIR}/${slug}/gaps.json`);
  }

  if (removeCompany) {
    const targets = items.filter((i) => i.companyId === removeCompany);
    for (const it of targets) {
      const s = await api.listingState(it.listingId);
      if (s?.metadata.photoSource !== "operator_website") continue; // only photos this importer added
      await call("command", `${INTEG}/listings/update`, { method: "POST", headers: await headers("integ", true), body: JSON.stringify({ id: it.listingId, images: [], metadata: { photoSource: "removed" }, privateData: { photoSource: null } }) }, true);
      fs.appendFileSync(ledgerFile, `${JSON.stringify({ at: new Date().toISOString(), externalId: it.externalId, companyId: it.companyId, listingId: it.listingId, outcome: "removed" })}\n`);
    }
    if (!takedowns.some((t) => t.companyId === removeCompany)) takedowns.push({ companyId: removeCompany, at: new Date().toISOString() });
    writeJsonAtomic(TAKEDOWNS, { takedowns });
    console.log(`Removed imported photos for ${removeCompany} (${targets.length} listings checked) and added it to the takedown list.`);
    return;
  }

  // Resume: skip listings an earlier run already finished (photo attached and approved, or approved).
  const done = new Set<string>();
  if (fs.existsSync(ledgerFile)) {
    for (const line of fs.readFileSync(ledgerFile, "utf8").split("\n")) {
      if (!line) continue;
      const e = JSON.parse(line) as { externalId: string; outcome: string };
      if (["attached_approved", "attached", "already_has_images"].includes(e.outcome)) done.add(e.externalId);
    }
  }
  if (apply && !argv.includes("--recheck")) items = items.filter((i) => !done.has(i.externalId));
  if (argv.includes("--approve-remaining")) {
    // Founder go 2026-10-05: every imported listing live in Test, with or without a photo.
    // Live: founder go 2026-10-14 (production cutover), given per run with --founder-go like ops:anonymize.
    if (target !== "test" && !argv.includes("--founder-go")) throw new Error("Refusing: --approve-remaining on Live needs --founder-go.");
    const ids = Object.entries(mapping as Record<string, { listingId: string; companyId: string }>);
    let approved = 0;
    for (const [externalId, m] of ids) {
      if (takedowns.some((t) => t.companyId === m.companyId)) continue;
      const s = await api.listingState(m.listingId);
      if (!s || s.state !== "pendingApproval" || s.authorClaimStatus !== "unclaimed") continue;
      await api.approve(m.listingId);
      approved++;
      fs.appendFileSync(ledgerFile, `${JSON.stringify({ at: new Date().toISOString(), runId: "approve-remaining", externalId, companyId: m.companyId, listingId: m.listingId, outcome: s.images ? "approved" : "approved_without_photo" })}\n`);
    }
    console.log(`Approved ${approved} remaining listings.`);
    return;
  }
  if (list("company")) items = items.filter((i) => list("company")!.includes(i.companyId));
  if (list("only")) items = items.filter((i) => list("only")!.includes(i.externalId));
  if (opt("limit")) items = items.slice(0, Number(opt("limit")));
  console.log(`Photos: ${items.length} listings selected; ${noPhoto} rides have no source photo; ${notCreated} listings not created yet; ${takedowns.length} companies on the takedown list.`);
  if (!apply) return console.log("DRY RUN — nothing uploaded.");

  const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomBytes(3).toString("hex")}`;
  if (approve && target !== "test" && !argv.includes("--founder-go")) throw new Error("Refusing: --approve on Live needs --founder-go (founder go 2026-10-14 for the cutover).");
  const results = await runPhotoImport(items, {
    api,
    approve,
    concurrency: Number(opt("concurrency") ?? 3),
    takedowns: new Set(takedowns.map((t) => t.companyId)),
    now: () => new Date().toISOString(),
    runId,
    onResult(e: PhotoLedgerEntry) {
      const line = { ...e, detail: e.detail ? redact(e.detail) : undefined };
      fs.appendFileSync(ledgerFile, `${JSON.stringify(line)}\n`);
      if (e.outcome !== "already_has_images") console.log(`  ${e.outcome.padEnd(18)} ${e.externalId.padEnd(52)} ${e.imageId ?? ""}${e.detail ? `  ${line.detail}` : ""}`);
    },
  });
  const tally: Record<string, number> = {};
  for (const r of results) tally[r.outcome] = (tally[r.outcome] ?? 0) + 1;
  console.log(`\nResult: ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(", ")}\nLedger: ${ledgerFile}`);
})().catch((e) => {
  console.error(redact((e as Error).message));
  process.exit(1);
});
