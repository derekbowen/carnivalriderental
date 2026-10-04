/**
 * Verify the latest Sharetribe snapshot (npm run sharetribe:inspect) against the contract.
 * Exit 0 ONLY when every check matched. Unverified checks are not passes.
 */
import fs from "node:fs";
import { CONTRACT_VERSION, verifyConfiguration, type SharetribeSnapshot } from "../src/lib/contract";

const file = process.argv[2] ?? fs.readdirSync("contract/snapshots").filter((f) => f.endsWith(".json")).sort().map((f) => `contract/snapshots/${f}`).pop();
if (!file) {
  console.error("No snapshot found. Run npm run sharetribe:inspect first.");
  process.exit(1);
}
const snap = JSON.parse(fs.readFileSync(file, "utf8")) as SharetribeSnapshot;
const r = verifyConfiguration(snap);
console.log(`Contract ${CONTRACT_VERSION} vs ${snap.marketplaceName} (${file})`);
console.log(`  match ${r.counts.match} · drift ${r.counts.drift} · UNVERIFIED ${r.counts.unverified} → ${r.fullyVerified ? "FULLY VERIFIED (checked properties only)" : "NOT verified"}`);
for (const c of r.checks.filter((c) => c.status !== "match")) {
  console.log(`  ${c.status.toUpperCase().padEnd(10)} ${c.id} — expected ${JSON.stringify(c.expected)}, actual ${JSON.stringify(c.actual)}${c.note ? ` (${c.note})` : ""}`);
}
console.log(`  Outside this checker's coverage: ${r.outOfCoverage.join("; ")}`);
process.exit(r.fullyVerified ? 0 : 1);
