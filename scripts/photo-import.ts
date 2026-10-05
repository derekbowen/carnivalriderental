/**
 * Attach each imported listing's photo from the operator's own website (founder decision 2026-10-04).
 *
 *   npm run import:photos                                   # dry run: counts only
 *   npm run import:photos -- --apply --only a-and-a-attractions--berry-go-round
 *   npm run import:photos -- --apply                        # every created listing with a source photo
 *   npm run import:photos -- --remove acme-shows            # takedown: strip that company's imported photos
 *                                                           # and add it to imports/photos/takedowns.json
 * Options: --company id1,id2  --only externalId1,…  --limit N
 */
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { planListings } from "../src/lib/imports/operator-listings";
import { planPhotos, runPhotoImport, type PhotoApi, type PhotoLedgerEntry } from "../src/lib/imports/listing-photos";
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

// Polite downloads: one request per host per second, identified, bounded.
const lastHit = new Map<string, number>();
async function download(url: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const host = new URL(url).host;
  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const wait = (lastHit.get(host) ?? 0) + 2500 - Date.now(); // ≤ 1 request / 2.5 s per website
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastHit.set(host, Date.now());
    res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20000), headers: { "User-Agent": "CarnivalRideRental-ListingPhotos/1.0 (+https://carnivalriderental.us)", Accept: "image/*" } });
    if (res.status !== 429 && res.status !== 503) break;
    await new Promise((r) => setTimeout(r, 10000 * (attempt + 1))); // the site asked us to slow down
  }
  if (!res || !res.ok) throw new Error(`download HTTP ${res?.status}`);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > 60 * 1024 * 1024) throw new Error("download over 60 MB");
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
    const r = spawnSync("convert", ["-", "-resize", "2400x2400>", "-quality", "85", "jpg:-"], { input: Buffer.from(bytes), maxBuffer: 64 * 1024 * 1024 });
    return r.status === 0 && r.stdout.length > 0 ? new Uint8Array(r.stdout) : null;
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

(async () => {
  const wb = JSON.parse(fs.readFileSync("imports/company-accounts/source/workbook.json", "utf8"));
  const names = await marketplaceNames();
  if (names.integ !== names.mkt) throw new Error("Refusing: API clients point at different marketplaces.");
  if (target === "test" && names.integ !== TEST_MARKETPLACE) throw new Error(`Refusing: --target test but marketplace is "${names.integ}".`);
  if (target === "live" && opt("confirm-live") !== names.integ) throw new Error(`Refusing: pass --confirm-live "${names.integ}".`);
  const slug = names.integ.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const mapping = JSON.parse(fs.readFileSync(`imports/listings/${slug}/mapping.json`, "utf8")).listings;
  const takedowns: { companyId: string; at: string }[] = fs.existsSync(TAKEDOWNS) ? JSON.parse(fs.readFileSync(TAKEDOWNS, "utf8")).takedowns : [];
  const ledgerFile = `${DIR}/${slug}/ledger.jsonl`;
  fs.mkdirSync(path.dirname(ledgerFile), { recursive: true });

  const plan = planListings(wb);
  let { items, noPhoto, notCreated } = planPhotos(plan.rows, mapping);

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
      if (e.outcome === "attached_approved" || e.outcome === "approved") done.add(e.externalId);
    }
  }
  if (apply && !argv.includes("--recheck")) items = items.filter((i) => !done.has(i.externalId));
  if (argv.includes("--approve-remaining")) {
    // Founder go 2026-10-05: every imported listing live in Test, with or without a photo.
    if (target !== "test") throw new Error("Refusing: --approve-remaining is for the Test marketplace only.");
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
  if (approve && target !== "test") throw new Error("Refusing: --approve is founder-approved for the Test marketplace only.");
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
