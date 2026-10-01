/** Compare the latest Sharetribe snapshot (npm run sharetribe:inspect) with the contract. Exit 1 on drift. */
import fs from "node:fs";
import { CONTRACT_VERSION, diffAgainstSnapshot, type SharetribeSnapshot } from "../src/lib/contract";

const file = process.argv[2] ?? fs.readdirSync("contract/snapshots").filter((f) => f.endsWith(".json")).sort().map((f) => `contract/snapshots/${f}`).pop();
if (!file) {
  console.error("No snapshot found. Run npm run sharetribe:inspect first.");
  process.exit(1);
}
const snap = JSON.parse(fs.readFileSync(file, "utf8")) as SharetribeSnapshot;
const drift = diffAgainstSnapshot(snap);
console.log(`Contract ${CONTRACT_VERSION} vs ${snap.marketplaceName} (${file}): ${drift.length} difference(s)`);
for (const d of drift) console.log(`  ${d.kind.padEnd(10)} ${d.what} — ${d.detail}`);
process.exit(drift.length ? 1 : 0);
