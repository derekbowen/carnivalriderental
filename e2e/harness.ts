import fs from "node:fs";

/**
 * The offline catalog harness (CATALOG_SOURCE_FILE). Pages with ISR (`revalidate`) cache their first
 * render for 10 minutes and Next prefetches linked routes, so a hub rendered while this file is
 * absent would stay empty for every later spec. The global setup writes it before the server starts;
 * specs that need other data overwrite it for their own paths.
 */
export const HARNESS_FILE = "data/e2e-catalog.json";
const BINDING = { listingType: "managed-ride-rental", transactionProcessAlias: "default-negotiation/release-1", unitType: "offer" };

export function writeCategorySamples(file = HARNESS_FILE) {
  const samples = JSON.parse(fs.readFileSync("catalog/test-samples.json", "utf8")).samples as { title: string; description: string; publicData: object; metadata: object }[];
  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync(
    file,
    JSON.stringify({ data: samples.map((s, i) => ({ id: `dddddddd-0000-0000-0000-00000000000${i + 1}`, attributes: { title: s.title, description: s.description, state: "published", publicData: { ...BINDING, ...s.publicData }, metadata: s.metadata } })) }),
  );
}
