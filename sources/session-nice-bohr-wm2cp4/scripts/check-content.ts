/** Prints the publication gate result for every SEO route. Exit 1 on integrity errors. */
import { getContent } from "../src/lib/content";
import { allSeoRoutes } from "../src/lib/seo/publication";

try {
  getContent();
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
for (const r of allSeoRoutes()) {
  console.log(`${r.gate.indexable ? "INDEXABLE " : "noindex   "} ${r.family.padEnd(9)} ${r.path}${r.gate.indexable ? "" : "  — " + r.gate.reasons.join("; ")}`);
}
