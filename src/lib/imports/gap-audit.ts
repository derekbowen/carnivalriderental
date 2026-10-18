/**
 * National gap audit (2026-10-06) → import workbook rows (founder go 2026-10-18: "all missing
 * equipment, with photos, and full descriptions"). Pure logic, no network. The output is appended to
 * the existing workbook (imports/company-accounts/source/workbook.json) so the unchanged importers
 * (planImport, planListings, the anonymous Live payloads, the photo importer) validate, dedupe and
 * privacy-check it exactly like the original rows. Docs: docs/GAP_AUDIT_IMPORT.md.
 *
 * What is taken (and why the rest is not):
 * - Rides the audit marks READY, plus REVIEW rides that are on the operator's own current site and
 *   already named. Registry-only rows, uncertain ownership, HOLD (single weak source) and REJECT (not
 *   carnival rides) are left out: they are not verified current equipment of an operator we can sell.
 * - Only under a company we can stand behind: an existing company (C_verify_first is promoted to
 *   A_ready only when the audit has a READY ride for it), or a new company the audit marks READY.
 *   Companies the audit flags inactive, renamed or historical are skipped.
 * - Descriptions are the audit's ride summary with inspection, registration, insurance, price and
 *   availability claims removed (CLAUDE.md: never claim those), plus the verified facts it recorded.
 *   Nothing is invented: a missing value stays out.
 */
import { IMPORT_BATCH, PLACEHOLDER } from "./company-accounts";
import { RIDE_CLASSES } from "./operator-listings";

export type CsvRow = Record<string, string>;

/** RFC 4180 CSV: quoted fields, doubled quotes, newlines inside quotes, optional BOM. */
export function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  return (body ?? []).map((r) => Object.fromEntries((head ?? []).map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

export interface AuditFiles {
  companiesNew: CsvRow[];
  ridesNew: CsvRow[];
  companiesUpdates: CsvRow[];
  inactive: CsvRow[];
  /**
   * The operator's own description of each ride, copied from its source page (imports/gap-audit/ride-text.json,
   * keyed by listing externalId). Preferred over the audit's one-line summary; the same filters apply.
   */
  rideText?: Record<string, string>;
}

interface WbUser { externalId: string; importTier: string; metadata: string; publicData: string; privateData: string; protectedData: string; [k: string]: unknown }
interface WbListing { externalId: string; [k: string]: unknown }
export interface GapWorkbook {
  source: { file: string; sha256: string; [k: string]: unknown };
  users: WbUser[];
  companies: { companyId: string; importTier: string }[];
  listings: WbListing[];
}

export type Geocode = (city: string, state: string) => { lat: number; lng: number } | null;

export const IMPORT_SOURCE = "gap-audit-2026-10-06";
const STATE = /^[A-Z]{2}$/;
const J = (s: string): Record<string, unknown> => JSON.parse(s) as Record<string, unknown>;
export const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const states = (v: string) => [...new Set(v.split(/[|,;/]/).map((x) => x.trim().toUpperCase()).filter((x) => STATE.test(x)))];

/** "60 ft" → 60, "42 in" → 3.5 when feet are asked for; null when absent or unreadable. */
export function feet(v: string): number | null {
  const m = v.match(/(\d+(?:\.\d+)?)\s*(ft|feet|foot|'|in|inch|inches|")?/i);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = (m[2] ?? "ft").toLowerCase();
  const ft = /^(in|inch|inches|")$/.test(unit) ? n / 12 : n;
  return ft > 0 && ft < 1000 ? Math.round(ft * 10) / 10 : null;
}
/** '42" minimum' / "48 in" / "4 ft" → inches (integer); null otherwise. */
export function inches(v: string): number | null {
  const m = v.match(/(\d+(?:\.\d+)?)\s*(ft|feet|foot|'|in|inch|inches|")?/i);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = (m[2] ?? '"').toLowerCase();
  const inch = /^(ft|feet|foot|')$/.test(unit) ? n * 12 : n;
  return inch >= 24 && inch <= 84 ? Math.round(inch) : null;
}

/**
 * Clauses that would assert something we never claim (CLAUDE.md): insurance, certification, safety
 * guarantees, prices, availability, and ownership ("we own our rides": no listing field verifies it).
 */
const CLAIM = /\$\s?\d|\b(inspect|regist|insur|certif|licen[cs]|permit|sticker|state[- ]approved|safety record|guarantee|price|priced|rates?\b|rated\b|per (day|hour|event)\b|availab|book(ed|ing)? now|call (us|today)|we own|owns? (all |each |every )?(of )?(our|its|their) (own )?(rides|equipment)|own(ed)?[- ]and[- ]operated|owner[- ]operated|family[- ]owned|our own (rides|equipment|fleet))/i;
/** Research phrasing that is about our sources, not the ride. */
const SOURCE_TALK = /\b(?:the |operator(?:'s)? )?(?:site|page|website|listing|catalog) (?:says|states|notes|lists|shows|describes)(?: (?:it|that|the ride|them) (?:is|are|as))?\s*/gi;

/** Research notes about where a fact came from: not ride text, so never public. */
const NOTE = /\b(page|site|website|menu|catalog(ue)?|sitemap|listed on|details on|category (from|inferred|is a default)|name only|no photo|entry in|thrill level|offered for rental|according to|per the|registry|record #|needs? (a human|naming)|unverified|confirm(ed)? (by|on|via))\b/i;
/** Words too generic to identify a company ("Amusements", "Rides", "Shows"). */
const GENERIC = new Set(["amusement", "amusements", "attraction", "attractions", "carnival", "carnivals", "company", "rental", "rentals", "ride", "rides", "show", "shows", "event", "events", "entertainment", "party", "parties", "inflatable", "inflatables", "family", "midway", "midways", "fun", "funfair", "fair", "fairs", "great", "american", "united", "states", "enterprises", "services", "group", "productions", "inc", "llc", "corp", "the", "and", "of"]);

/** Distinctive words of a company's names (lower case, 4+ letters), to keep them out of public text. */
export function companyWords(names: (string | null | undefined)[]): string[] {
  return [...new Set(names.flatMap((n) => (n ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9']+/)).map((w) => w.replace(/'s$/, "")).filter((w) => w.length >= 4 && !GENERIC.has(w)))];
}

/** A clause that only states the rider height, or only the ride's dimensions. */
const HEIGHT_CLAUSE = /height requirements?|\bmust be \d+|\d+\s*("|\u2033|in\b|inch(es)?)\s*(tall\s*)?(to ride|minimum|or taller|with an adult|alone)/i;
const SIZE_CLAUSE = /\bdimensions?:|\bfootprint\b|\d+\s*('|\u2032|ft\b|feet)\s*(long|length|wide|width|depth|x|\u00d7)/i;

export function cleanSummary(text: string, avoid: string[] = [], opts: { keepHeight?: boolean; keepSize?: boolean; maxChars?: number } = {}): string {
  // Split into clauses at sentence ends and semicolons, but not after an abbreviation ("Dept.", "Co.").
  const clauses = text
    .replace(/\s+/g, " ")
    .replace(/\b(Dept|Co|Inc|Corp|Ltd|St|Mt|Ft|No|Jr|Sr|Mr|Mrs|Dr|vs|approx|ft|in|lbs?)\.(?=\s)/g, "$1\u0000")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"\u201c(])|;\s*/)
    .map((c) => c.replace(/\u0000/g, "."))
    .map((c) => c.replace(SOURCE_TALK, "").replace(/\s*[;,]\s*$/, "").trim())
    .filter((c) => c.split(" ").length >= 2 && !CLAIM.test(c) && !NOTE.test(c) && !/https?:\/\/|www\./i.test(c))
    // Height and size are stated once, from the parsed values (kept in the text when there are none).
    .filter((c) => opts.keepHeight || !HEIGHT_CLAUSE.test(c))
    .filter((c) => opts.keepSize || !SIZE_CLAUSE.test(c))
    .filter((c) => !avoid.some((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(c)));
  const out: string[] = [];
  for (const c of clauses.map((x) => x.charAt(0).toUpperCase() + x.slice(1)).map((x) => (/[.!?]$/.test(x) ? x : `${x}.`))) {
    if (opts.maxChars && [...out, c].join(" ").length > opts.maxChars) break;
    out.push(c);
  }
  return out.join(" ").trim();
}

const CLASS_NOUN: Record<string, string> = { kiddie: "Kiddie ride", family: "Family ride", major: "Major ride", spectacular: "Spectacular ride", coaster: "Roller coaster", funhouse: "Fun house or walk-through", "dark-ride": "Dark ride", water: "Water ride", other: "Carnival attraction" };

/** The listing description: the cleaned summary, then the verified facts the audit recorded. */
export function describeRide(r: CsvRow, cls: string, avoid: string[] = [], operatorText = ""): string {
  const parts: string[] = [];
  const keepHeight = !inches(r.minimum_height ?? "");
  const keepSize = !(feet(r.footprint_length ?? "") || feet(r.footprint_width ?? "") || feet(r.ride_height ?? ""));
  const summary = cleanSummary(operatorText, avoid, { keepHeight, keepSize, maxChars: 1200 }) || cleanSummary(r.description ?? "", avoid, { keepHeight, keepSize });
  parts.push(summary || `${CLASS_NOUN[cls] ?? "Carnival ride"} listed by an independent operator.`);
  const minIn = inches(r.minimum_height ?? "");
  if (minIn) parts.push(`Rider rules: minimum height ${minIn} in.`);
  const cap = (r.capacity ?? "").match(/(\d+)\s*(riders?|people|passengers|seats|kids|children|adults)?/i);
  if (cap && Number(cap[1]) > 0 && Number(cap[1]) < 500) parts.push(`Capacity: ${cap[1]} ${cap[2] ? cap[2].toLowerCase() : "riders"}.`);
  const len = feet(r.footprint_length ?? "");
  const wid = feet(r.footprint_width ?? "");
  const hgt = feet(r.ride_height ?? "");
  const space = [len && wid ? `${len} ft × ${wid} ft footprint` : len ? `${len} ft long` : wid ? `${wid} ft wide` : null, hgt ? `${hgt} ft tall` : null].filter(Boolean);
  if (space.length) parts.push(`Size: ${space.join(", ")}. Confirm the space needed with the operator.`);
  return parts.join("\n\n");
}

export interface GapPlan {
  users: WbUser[];
  listings: WbListing[];
  /** existing C_verify_first companies promoted to A_ready because the audit has a READY ride for them */
  promoted: string[];
  /** HQ placed from the audit's READY updates, for promoted companies whose row had none */
  placed: Record<string, { hqCity: string; hqState: string; lat: number; lng: number; statesServed: string[] }>;
  skipped: Record<string, number>;
  stats: Record<string, number>;
}

/** The audit's READY field updates per existing company (last value wins). */
function readyUpdates(rows: CsvRow[]): Map<string, Record<string, string>> {
  const m = new Map<string, Record<string, string>>();
  for (const u of rows) if (u.import_status === "READY" && u.company_id && u.new_value) m.set(u.company_id, { ...(m.get(u.company_id) ?? {}), [u.field]: u.new_value.trim() });
  return m;
}

/**
 * Build the rows to append. `wb` is the original workbook (never the merged one), so rerunning the
 * merge gives the same result.
 */
export function planGapAudit(audit: AuditFiles, wb: GapWorkbook, geocode: Geocode): GapPlan {
  const skipped: Record<string, number> = {};
  const skip = (why: string) => (skipped[why] = (skipped[why] ?? 0) + 1);
  const tier = new Map(wb.companies.map((c) => [c.companyId, c.importTier]));
  const userByCompany = new Map(wb.users.map((u) => [String(J(u.metadata).companyId), u]));
  const flagged = new Set(audit.inactive.map((r) => r.id).filter(Boolean));
  const existingListingIds = new Set(wb.listings.map((l) => l.externalId));
  const takenCompanyIds = new Set(wb.companies.map((c) => c.companyId));

  // Rides worth importing (before the company check).
  const rideOk = (r: CsvRow) => {
    if (r.import_status === "READY") return true;
    if (r.import_status !== "REVIEW") return false;
    if (r.ownership_status !== "current" || r.source_type !== "operator_site") return false;
    return !/needs a human to name|ride needs nam|name only on operator list/i.test(r.notes ?? "");
  };

  // New companies the audit marks READY.
  const newCompany = new Map<string, { row: CsvRow; companyId: string; externalId: string; lat: number; lng: number; hqCity: string; hqState: string }>();
  for (const c of audit.companiesNew) {
    if (c.import_status !== "READY" || c.gap_class !== "NEW_OPERATOR") continue;
    const hqState = (c.hq_state ?? "").toUpperCase();
    const hqCity = c.hq_city ?? "";
    const geo = STATE.test(hqState) && hqCity ? geocode(hqCity, hqState) : null;
    if (!geo) { skip("new company without a placeable HQ city and state"); continue; }
    let companyId = slug(c.company_name);
    if (!companyId) { skip("new company without a usable name"); continue; }
    if (takenCompanyIds.has(companyId)) companyId = `${companyId}-${hqState.toLowerCase()}`;
    if (takenCompanyIds.has(companyId)) { skip("new company id collides with an existing company"); continue; }
    takenCompanyIds.add(companyId);
    newCompany.set(c.entity_id, { row: c, companyId, externalId: `gap-${companyId}`, lat: geo.lat, lng: geo.lng, hqCity, hqState });
  }

  // READY ride evidence per existing company (decides C → A promotion).
  const readyFor = new Set(audit.ridesNew.filter((r) => r.import_status === "READY" && r.existing_company_id).map((r) => r.existing_company_id));
  const update = readyUpdates(audit.companiesUpdates);
  const promoted = new Set<string>();
  const placed: GapPlan["placed"] = {};
  const users: WbUser[] = [];
  const listings: WbListing[] = [];
  const usedNewCompanies = new Set<string>();
  const perCompanyTitles = new Map<string, Set<string>>();
  for (const l of wb.listings) {
    const cid = String(J(l.metadata as string).companyId);
    perCompanyTitles.set(cid, (perCompanyTitles.get(cid) ?? new Set()).add(slug(String(l.title))));
  }

  for (const r of audit.ridesNew) {
    if (!rideOk(r)) { skip(`ride ${r.import_status || "?"}: not verified current equipment`); continue; }
    const title = (r.ride_name ?? "").replace(/\s+/g, " ").trim();
    if (!title) { skip("ride without a name"); continue; }
    const cls = (RIDE_CLASSES as readonly string[]).includes(r.ride_class) ? r.ride_class : "other";

    let author: { externalId: string; companyId: string; homeState: string; city: string; lat: number; lng: number; statesServed: string[]; avoid: string[] };
    if (r.gap_class === "NEW_OPERATOR") {
      const nc = newCompany.get(r.entity_id);
      if (!nc) { skip("ride at a new company that is not READY"); continue; }
      usedNewCompanies.add(r.entity_id);
      author = { externalId: nc.externalId, companyId: nc.companyId, homeState: nc.hqState, city: nc.hqCity, lat: nc.lat, lng: nc.lng, statesServed: states(nc.row.states_served ?? ""), avoid: companyWords([nc.row.company_name, nc.row.legal_name_if_known, ...(nc.row.dba_names ?? "").split(/[|;]/), nc.row.contact_name]) };
    } else {
      const cid = r.existing_company_id;
      const u = userByCompany.get(cid);
      const t = tier.get(cid);
      if (!u || !t) { skip("ride at an existing company with no account row"); continue; }
      if (t === "D_exclude") { skip("ride at an excluded company"); continue; }
      if (flagged.has(cid)) { skip("ride at a company the audit flags inactive, renamed or historical"); continue; }
      if (t === "C_verify_first") {
        if (!readyFor.has(cid)) { skip("ride at a verify-first company with no READY evidence"); continue; }
        promoted.add(cid);
      }
      const pub = J(u.publicData);
      const priv = J(u.privateData);
      // A promoted company whose row has no HQ takes it from the audit's READY update (applied in mergeWorkbook).
      const up = t === "C_verify_first" ? update.get(cid) : undefined;
      const hqState = String(pub.hqState ?? up?.hq_state?.toUpperCase() ?? "");
      const hqCity = String(pub.hqCity ?? up?.hq_city ?? "");
      // Older rows have no stored coordinates: place them from their HQ city, as the new companies are.
      const stored = priv.hqLat !== undefined && priv.hqLng !== undefined && Number.isFinite(Number(priv.hqLat)) && Number.isFinite(Number(priv.hqLng));
      const geo = stored ? { lat: Number(priv.hqLat), lng: Number(priv.hqLng) } : STATE.test(hqState) && hqCity ? geocode(hqCity, hqState) : null;
      if (!STATE.test(hqState) || !geo) { skip("ride at an existing company without a placeable HQ"); continue; }
      const { lat, lng } = geo;
      const servedNow = Array.isArray(pub.statesServed) ? (pub.statesServed as string[]) : [];
      const servedUp = states(up?.states_operated ?? "");
      if (t === "C_verify_first" && (!stored || !pub.hqState)) placed[cid] = { hqCity, hqState, lat, lng, statesServed: servedNow.length ? servedNow : servedUp };
      const owners = Array.isArray(priv.owners) ? (priv.owners as { name?: string }[]).map((o) => o.name) : [];
      author = { externalId: u.externalId, companyId: cid, homeState: hqState, city: hqCity, lat, lng, statesServed: servedNow.length ? servedNow : servedUp, avoid: companyWords([String(u.displayName ?? ""), String(pub.companyName ?? ""), String(priv.legalEntityName ?? ""), String(priv.contactName ?? ""), ...owners]) };
    }

    const titles = perCompanyTitles.get(author.companyId) ?? new Set<string>();
    if (titles.has(slug(title))) { skip("same ride name already listed for this company"); continue; }
    titles.add(slug(title));
    perCompanyTitles.set(author.companyId, titles);

    let externalId = `${author.companyId}--${slug(title)}`.slice(0, 120).replace(/-+$/, "");
    for (let n = 2; existingListingIds.has(externalId); n++) externalId = `${author.companyId}--${slug(title)}-${n}`;
    existingListingIds.add(externalId);

    const fromOperatorSite = r.source_type === "operator_site";
    const len = feet(r.footprint_length ?? "");
    const wid = feet(r.footprint_width ?? "");
    const hgt = feet(r.ride_height ?? "");
    const minIn = inches(r.minimum_height ?? "");
    const ownDims = fromOperatorSite && !!(len || wid || hgt);
    const served = states(r.service_states ?? "");
    const photo = (r.photo_urls ?? "").split(/\s*[|;\s]\s*/).find((u) => /^https?:\/\//i.test(u)) ?? null;
    const mfr = (r.manufacturer ?? "").trim();
    const conf = r.confidence === "high" || r.confidence === "medium" || r.confidence === "low" ? r.confidence : "low";

    listings.push({
      externalId,
      authorExternalId: author.externalId,
      title,
      description: describeRide(r, cls, author.avoid, audit.rideText?.[externalId] ?? ""),
      lat: author.lat,
      lng: author.lng,
      imageUrl: photo,
      publicData: JSON.stringify({
        rideCategory: cls,
        ...(mfr ? { manufacturer: mfr } : {}),
        ...((r.model ?? "").trim() ? { rideModel: r.model.trim() } : {}),
        footprintSource: ownDims ? "operator_website" : "unknown",
        ...(ownDims && len ? { footprintLengthFt: len } : {}),
        ...(ownDims && wid ? { footprintWidthFt: wid } : {}),
        ...(ownDims && hgt ? { rideHeightFt: hgt } : {}),
        ...(minIn ? { minRiderHeightIn: minIn } : {}),
        homeState: author.homeState,
        serviceStates: served.length ? served : author.statesServed.length ? author.statesServed : [author.homeState],
        location: { address: author.city ? `${author.city}, ${author.homeState}` : author.homeState, building: "" },
      }),
      privateData: JSON.stringify({
        ...(r.source_page ? { sourceRidePage: r.source_page } : {}),
        ...(photo ? { sourceImageUrl: photo } : {}),
        // Manufacturer is public only when printed on the operator's own site with high confidence.
        ...(mfr ? { mfrConfidence: fromOperatorSite && conf === "high" ? "high" : conf === "high" ? "medium" : conf } : {}),
      }),
      metadata: JSON.stringify({ claimStatus: "unclaimed", importBatch: IMPORT_BATCH, companyId: author.companyId }),
    });
  }

  // Account rows for the new companies that have at least one ride.
  for (const [entity, nc] of newCompany) {
    if (!usedNewCompanies.has(entity)) { skip("new company with no importable rides"); continue; }
    const c = nc.row;
    const name = c.company_name.replace(/\s+/g, " ").trim();
    const [first, ...rest] = name.split(" ");
    const website = /^https?:\/\//i.test(c.website ?? "") ? c.website : c.website ? `https://${c.website}` : "";
    let validSite: string | undefined;
    try { validSite = website ? new URL(website).toString() : undefined; } catch { validSite = undefined; }
    const served = states(c.states_served ?? "");
    const sources = (c.sources ?? "").split(/\s*[|;\s]\s*/).filter((u) => /^https?:\/\//i.test(u));
    users.push({
      externalId: nc.externalId,
      importTier: "A_ready",
      emailPlaceholder: `${nc.companyId}@${PLACEHOLDER}`,
      firstName: first,
      lastName: rest.join(" ") || "Rides",
      displayName: name,
      bio: null,
      publicData: JSON.stringify({ companyName: name, hqCity: nc.hqCity, hqState: nc.hqState, ...(served.length ? { statesServed: served } : {}), ...(validSite ? { website: validSite } : {}) }),
      protectedData: JSON.stringify((c.phone ?? "").replace(/\D/g, "").length >= 7 ? { phoneNumber: c.phone } : {}),
      privateData: JSON.stringify({
        ...(c.legal_name_if_known ? { legalEntityName: c.legal_name_if_known } : {}),
        ...(c.contact_name ? { contactName: c.contact_name } : {}),
        ...(c.email ? { contactEmail: c.email } : {}),
        ...(c.hq_zip ? { hqZip: c.hq_zip } : {}),
        hqLat: nc.lat,
        hqLng: nc.lng,
        ...(sources.length ? { sources } : {}),
        ...(c.status_evidence ? { researchNotes: c.status_evidence } : {}),
      }),
      metadata: JSON.stringify({ claimStatus: "unclaimed", importBatch: IMPORT_BATCH, companyId: nc.companyId, importSource: IMPORT_SOURCE, researchStatus: c.active_status || "active" }),
    });
  }

  for (const cid of Object.keys(placed)) if (!promoted.has(cid)) delete placed[cid];
  return {
    users,
    listings,
    promoted: [...promoted].sort(),
    placed,
    skipped,
    stats: {
      newCompanies: users.length,
      promotedCompanies: promoted.size,
      listings: listings.length,
      listingsWithPhoto: listings.filter((l) => l.imageUrl).length,
      listingsAtNewCompanies: listings.filter((l) => String(l.authorExternalId).startsWith("gap-")).length,
    },
  };
}

/**
 * The original workbook plus the gap rows. Promoted companies move to A_ready in both the Companies
 * and Users sheets (planImport cross-checks the two). Contact updates the audit marks READY are applied
 * only to promoted companies, whose accounts don't exist yet; existing accounts are never rewritten.
 */
export function mergeWorkbook(wb: GapWorkbook, plan: GapPlan, updates: CsvRow[]): GapWorkbook {
  const promoted = new Set(plan.promoted);
  const ready = updates.filter((u) => u.import_status === "READY" && promoted.has(u.company_id));
  const users = wb.users.map((u) => {
    const cid = String(J(u.metadata).companyId);
    if (!promoted.has(cid)) return u;
    const pub = J(u.publicData);
    const priv = J(u.privateData);
    const prot = J(u.protectedData);
    for (const up of ready.filter((x) => x.company_id === cid)) {
      const v = (up.new_value ?? "").trim();
      if (!v) continue;
      if (up.field === "website" && /^https?:\/\/\S+\.\S+/i.test(v)) pub.website = v;
      if (up.field === "phone" && v.replace(/\D/g, "").length >= 7) prot.phoneNumber = v;
      if (up.field === "email" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) priv.contactEmail = v;
      if (up.field === "legal_entity_name") priv.legalEntityName = v;
    }
    const where = plan.placed[cid];
    if (where) {
      if (!pub.hqCity) pub.hqCity = where.hqCity;
      if (!pub.hqState) pub.hqState = where.hqState;
      if (!Array.isArray(pub.statesServed) && where.statesServed.length) pub.statesServed = where.statesServed;
      if (priv.hqLat === undefined) priv.hqLat = where.lat;
      if (priv.hqLng === undefined) priv.hqLng = where.lng;
    }
    return { ...u, importTier: "A_ready", publicData: JSON.stringify(pub), privateData: JSON.stringify(priv), protectedData: JSON.stringify(prot) };
  });
  return {
    ...wb,
    source: { ...wb.source, gapAudit: { importSource: IMPORT_SOURCE, newCompanies: plan.users.length, promoted: plan.promoted.length, listings: plan.listings.length, listingIds: plan.listings.map((l) => l.externalId) } },
    users: [...users, ...plan.users],
    companies: [...wb.companies.map((c) => (promoted.has(c.companyId) ? { ...c, importTier: "A_ready" } : c)), ...plan.users.map((u) => ({ companyId: String(J(u.metadata).companyId), importTier: "A_ready" }))],
    listings: [...wb.listings, ...plan.listings],
  };
}
