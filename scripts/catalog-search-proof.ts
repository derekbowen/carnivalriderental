/**
 * Live search proof against the active environment's PUBLIC Marketplace API.
 * Expected results are derived from catalog/test-samples.json + catalog/listing-map.test.json.
 * Prints every request and the returned listing ids. Exit 1 on any mismatch.
 * NOTE: this proves OUR query semantics (has_any). Sharetribe's hosted template uses has_all
 * for Console multi-select filters; that is a different behaviour and is not tested here.
 */
import fs from "node:fs";
import { queryPublicListings } from "../src/lib/catalog/source";

const MAP_FILE = "catalog/listing-map.test.json";
const map: Record<string, string> = fs.existsSync(MAP_FILE) ? JSON.parse(fs.readFileSync(MAP_FILE, "utf8")) : {};
type Sample = { publicData: { categoryLevel1: string }; metadata: { offerKey: string; requestableStates: string[] } };
const samples = (JSON.parse(fs.readFileSync("catalog/test-samples.json", "utf8")) as { samples: Sample[] }).samples;

const idsWhere = (pred: (s: Sample) => boolean) => samples.filter(pred).map((s) => map[s.metadata.offerKey]).filter(Boolean).sort();
const anyOf = (states: string[]) => (s: Sample) => s.metadata.requestableStates.some((x) => states.includes(x));

const cases: { name: string; params: Record<string, string>; expect: string[] }[] = [
  { name: "category ferris-wheels", params: { pub_categoryLevel1: "ferris-wheels" }, expect: idsWhere((s) => s.publicData.categoryLevel1 === "ferris-wheels") },
  { name: "category carousels", params: { pub_categoryLevel1: "carousels" }, expect: idsWhere((s) => s.publicData.categoryLevel1 === "carousels") },
  { name: "category thrill-rides (none)", params: { pub_categoryLevel1: "thrill-rides" }, expect: [] },
  { name: "coverage TX (has_any)", params: { meta_requestableStates: "has_any:tx" }, expect: idsWhere(anyOf(["tx"])) },
  { name: "coverage AZ (has_any)", params: { meta_requestableStates: "has_any:az" }, expect: idsWhere(anyOf(["az"])) },
  { name: "coverage TX or AZ (has_any)", params: { meta_requestableStates: "has_any:tx,az" }, expect: idsWhere(anyOf(["tx", "az"])) },
  { name: "coverage CO (unrelated, none)", params: { meta_requestableStates: "has_any:co" }, expect: [] },
  { name: "coverage OK", params: { meta_requestableStates: "has_any:ok" }, expect: idsWhere(anyOf(["ok"])) },
];

(async () => {
  const seeded = samples.filter((s) => map[s.metadata.offerKey]).length;
  if (seeded < samples.length) {
    console.log(`INCONCLUSIVE: ${seeded}/${samples.length} samples seeded. Empty results cannot prove inclusion or exclusion. Seed first (npm run catalog:seed -- --apply).`);
  }
  let failed = 0;
  for (const c of cases) {
    const r = await queryPublicListings(c.params);
    const got = r.listings.map((l) => l.id).sort();
    const ok = r.status === 200 && JSON.stringify(got) === JSON.stringify(c.expect);
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"} ${c.name}\n  GET ${r.url}\n  HTTP ${r.status} → [${got.join(", ")}] expected [${c.expect.join(", ")}]${r.body ? `\n  error: ${JSON.stringify(r.body).slice(0, 300)}` : ""}`);
  }
  // A filter Sharetribe silently ignores returns EVERYTHING; the exclusion cases (CO, thrill-rides) catch that,
  // but only once listings exist.
  process.exit(failed ? 1 : seeded < samples.length ? 2 : 0);
})();
