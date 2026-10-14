/**
 * Verify a Sharetribe snapshot (npm run sharetribe:inspect) against a contract.
 * Exit 0 ONLY when every check matched. Unverified checks are not passes.
 *
 *   npm run contract:diff                                # operator contract, latest Test snapshot
 *   npm run contract:diff -- --target live               # operator contract, latest Live snapshot
 *   npm run contract:diff -- --contract managed          # legacy managed-rental contract (retired model)
 *   npm run contract:diff -- contract/snapshots/<file>   # an explicit snapshot
 *
 * The snapshot is chosen by the marketplace NAME recorded inside it and its capturedAt time, never by
 * filename order ("carnivalrental-test-…" sorts after "carnivalrental-…", which once made a Live check
 * read an old Test snapshot).
 */
import fs from "node:fs";
import { CONTRACT_VERSION, verifyConfiguration, type SharetribeSnapshot } from "../src/lib/contract";
import { verifyOperatorConfiguration } from "../src/lib/contract/operator";
import operatorContract from "../contract/operator-listing-contract.json";

export const MARKETPLACES = { test: "CarnivalRental Test", live: "CarnivalRental" } as const;

const argv = process.argv.slice(2);
const opt = (n: string) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const target = (opt("target") ?? "test") as keyof typeof MARKETPLACES;
const which = opt("contract") ?? "operator";
const explicit = argv.find((a, i) => a.endsWith(".json") && argv[i - 1] !== "--target" && argv[i - 1] !== "--contract");
if (!(target in MARKETPLACES)) throw new Error(`--target must be test or live`);

type Snap = SharetribeSnapshot & { capturedAt?: string; marketplaceApiClient?: string };
function pick(): { file: string; snap: Snap } {
  if (explicit) return { file: explicit, snap: JSON.parse(fs.readFileSync(explicit, "utf8")) };
  const want = MARKETPLACES[target];
  const all = fs
    .readdirSync("contract/snapshots")
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ file: `contract/snapshots/${f}`, snap: JSON.parse(fs.readFileSync(`contract/snapshots/${f}`, "utf8")) as Snap }))
    .filter((s) => s.snap.marketplaceName === want && typeof s.snap.capturedAt === "string")
    .sort((a, b) => a.snap.capturedAt!.localeCompare(b.snap.capturedAt!));
  const latest = all.pop();
  if (!latest) {
    console.error(`No snapshot of "${want}" found. Run: npm run sharetribe:inspect${target === "live" ? " -- --target live" : ""}`);
    process.exit(1);
  }
  return latest;
}

const { file, snap } = pick();
if (!explicit && snap.marketplaceName !== MARKETPLACES[target]) throw new Error(`Refusing: ${file} is "${snap.marketplaceName}", not ${MARKETPLACES[target]}`);
const r = which === "managed" ? verifyConfiguration(snap) : verifyOperatorConfiguration(snap);
const label = which === "managed" ? `managed-rental contract ${CONTRACT_VERSION} (retired model)` : `operator contract ${operatorContract.contractVersion}`;
console.log(`${label} vs "${snap.marketplaceName}" (${file}, captured ${snap.capturedAt ?? "?"})`);
console.log(`  match ${r.counts.match} · drift ${r.counts.drift} · UNVERIFIED ${r.counts.unverified} → ${r.fullyVerified ? "FULLY VERIFIED (checked properties only)" : "NOT verified"}`);
for (const c of r.checks.filter((c) => c.status !== "match")) {
  console.log(`  ${c.status.toUpperCase().padEnd(10)} ${c.id} — expected ${JSON.stringify(c.expected)}, actual ${JSON.stringify(c.actual)}${c.note ? ` (${c.note})` : ""}`);
}
console.log(`  Outside this checker's coverage: ${r.outOfCoverage.join("; ")}`);
process.exit(r.fullyVerified ? 0 : 1);
