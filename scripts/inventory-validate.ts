/**
 * Validate the public inventory snapshot before it is used for pages, and report ride-type matching.
 *
 *   npm run inventory:validate        # exit 1 on any privacy or schema problem
 *
 * Checks (always): required fields and types, ids unique, no contact-like strings (emails, phones,
 * URLs other than Sharetribe image CDN), no identity keys, known ride classes and ride types.
 * Checks (when the import workbook is present, i.e. on the transactional side): no company name,
 * legal name, owner/contact name or company web domain appears anywhere in the snapshot.
 * Writes reports/inventory-match.json: counts per canonical ride type, unmatched and ambiguous titles.
 */
import fs from "node:fs";
import contract from "../contract/operator-listing-contract.json";
import rideTypesFile from "../src/lib/taxonomy/ride-types.json";
import { matchingRideTypes, MATCHED_RIDE_TYPES } from "../src/lib/inventory/match";

type Ride = { id: string; title: string; rideClass: string | null; rideType: string | null; rateKey: string; homeState: string | null; serviceStates: string[]; lat: number; lng: number; photo: string | null; facts: { label: string; value: string }[]; claimed: boolean };
const snap = JSON.parse(fs.readFileSync("src/lib/inventory/rides.json", "utf8")) as { rides: Ride[]; count: number };
const raw = fs.readFileSync("src/lib/inventory/rides.json", "utf8");
const problems: string[] = [];
const classes = new Set(contract.rideClass.options.map((o) => o.option));
const types = (rideTypesFile as { rideTypes: { id: string; name: string }[] }).rideTypes;
const typeIds = new Set(types.map((t) => t.id));

// Matcher ↔ taxonomy: exactly the 50 canonical ride types, nothing more.
if (typeIds.size !== 50) problems.push(`taxonomy has ${typeIds.size} ride types, expected 50`);
const extra = MATCHED_RIDE_TYPES.filter((t) => !typeIds.has(t));
const missing = [...typeIds].filter((t) => !MATCHED_RIDE_TYPES.includes(t));
if (extra.length || missing.length) problems.push(`matcher/taxonomy mismatch: extra ${extra.join(",")} missing ${missing.join(",")}`);

const ids = new Set<string>();
const IDENT_KEYS = ["companyName", "companyId", "companyCity", "description", "website", "email", "phone", "author", "privateData", "protectedData", "owners", "contactName"];
for (const r of snap.rides) {
  if (ids.has(r.id)) problems.push(`duplicate id ${r.id}`);
  ids.add(r.id);
  if (!/^[0-9a-f-]{36}$/.test(r.id) || !r.title?.trim()) problems.push(`bad id/title ${r.id}`);
  if (r.rideClass && !classes.has(r.rideClass)) problems.push(`unknown ride class ${r.rideClass} on ${r.id}`);
  if (r.rideType && !typeIds.has(r.rideType)) problems.push(`unknown ride type ${r.rideType} on ${r.id}`);
  if (!Number.isFinite(r.lat) || !Number.isFinite(r.lng)) problems.push(`no coordinates on ${r.id}`);
  if (Math.round(r.lat * 10) !== r.lat * 10 || Math.round(r.lng * 10) !== r.lng * 10) problems.push(`coordinates more precise than 0.1° on ${r.id}`);
  for (const k of Object.keys(r)) if (IDENT_KEYS.includes(k)) problems.push(`identity key ${k} on ${r.id}`);
  if (r.photo && !r.photo.startsWith("https://sharetribe.imgix.net/")) problems.push(`photo not on Sharetribe CDN: ${r.id}`);
}
if (snap.count !== snap.rides.length) problems.push("count mismatch");
if (/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(raw)) problems.push("email-like string in snapshot");
if (/https?:\/\/(?!sharetribe\.imgix\.net\/)/.test(raw)) problems.push("non-image URL in snapshot");
if (/\(?\b\d{3}\)?[-. ]\d{3}[-. ]\d{4}\b/.test(raw.replace(/"(photo|thumb)":"[^"]*"/g, ""))) problems.push("phone-like string in snapshot");

// Transactional side only: the private workbook is gitignored and never deployed.
const WB = "imports/company-accounts/source/workbook.json";
let identityChecked = 0;
if (fs.existsSync(WB)) {
  const wb = JSON.parse(fs.readFileSync(WB, "utf8")) as { users: { displayName: string; publicData: string; privateData: string }[] };
  const text = snap.rides.map((r) => [r.title, ...r.facts.map((f) => f.value)].join(" | ")).join("\n").toLowerCase();
  for (const u of wb.users) {
    const pub = JSON.parse(u.publicData || "{}");
    const priv = JSON.parse(u.privateData || "{}");
    const names = [u.displayName, pub.companyName, priv.legalEntityName, priv.contactName, ...(priv.owners ?? []).map((o: { name: string }) => o.name)].filter((x): x is string => typeof x === "string" && x.trim().length >= 5);
    let domain = "";
    try {
      domain = pub.website ? new URL(pub.website).hostname.replace(/^www\./, "") : "";
    } catch {}
    for (const n of [...names, domain].filter(Boolean)) {
      identityChecked++;
      const needle = n.toLowerCase();
      // Whole-word match so a company called "Fun Rides" does not flag the ride "Fun Rides Express" wrongly
      // only when it is the full company string.
      if (text.includes(needle)) problems.push(`identity leak: "${n}" appears in the snapshot`);
    }
  }
}

// Matching report.
const byType = new Map<string, number>(types.map((t) => [t.id, 0]));
const unmatched: string[] = [];
const ambiguous: { title: string; chosen: string | null; alsoMatches: string[] }[] = [];
for (const r of snap.rides) {
  if (r.rideType) byType.set(r.rideType, (byType.get(r.rideType) ?? 0) + 1);
  else unmatched.push(`${r.title} [${r.rideClass}]`);
  const all = matchingRideTypes(r.title, r.rideClass ?? "");
  if (all.length > 1) ambiguous.push({ title: r.title, chosen: r.rideType, alsoMatches: all.filter((t) => t !== r.rideType) });
}
const zero = [...byType].filter(([, n]) => n === 0).map(([t]) => t);
fs.mkdirSync("reports", { recursive: true });
fs.writeFileSync("reports/inventory-match.json", `${JSON.stringify({
  generatedFrom: "src/lib/inventory/rides.json",
  rides: snap.rides.length,
  matched: snap.rides.length - unmatched.length,
  unmatched: unmatched.length,
  ambiguous: ambiguous.length,
  byType: Object.fromEntries([...byType].sort((a, b) => b[1] - a[1])),
  typesWithNoRides: zero,
  unmatchedTitles: [...new Set(unmatched)].sort(),
  ambiguousSample: ambiguous.slice(0, 200),
}, null, 2)}\n`);

console.log(`Snapshot: ${snap.rides.length} rides; matched ${snap.rides.length - unmatched.length}, unmatched ${unmatched.length}, ambiguous ${ambiguous.length}; types with no rides: ${zero.length}. Identity terms checked: ${identityChecked}.`);
if (problems.length) {
  console.error(`${problems.length} problem(s):\n  ${[...new Set(problems)].slice(0, 40).join("\n  ")}`);
  process.exit(1);
}
console.log("OK: snapshot is safe to render.");
