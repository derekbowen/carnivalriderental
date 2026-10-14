/**
 * Renders the five lifecycle emails with sample data for review (no sending, no database):
 *   npm run lifecycle:preview -- [out-dir]   (default: the OS temp dir; never commit previews)
 * Writes one HTML file per template plus index.html. Sample values only; real emails take every fact
 * from the ledger (src/lib/lifecycle/engine.ts).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { LIFECYCLE_TEMPLATES, renderLifecycle, TEMPLATE_KIND, type LifecycleVars } from "../src/lib/lifecycle/templates";

const out = process.argv[2] || path.join(os.tmpdir(), "lifecycle-previews");
fs.mkdirSync(out, { recursive: true });
const sample: LifecycleVars = {
  city: "Riverside",
  state: "CA",
  eventDate: "2026-10-30",
  eventType: "school carnival or fundraiser",
  ride: "Ferris wheel",
  ridePlural: "Ferris wheels",
  alternativeTo: null,
  operators: 7,
  nearestMiles: 16,
  radiusMiles: 200,
  listings: [
    { title: "Giant Wheel", rideLabel: "Ferris wheel", miles: 16, thumb: null, operatorLabel: "Operator A" },
    { title: "Sky Wheel", rideLabel: "Ferris wheel", miles: 25, thumb: null, operatorLabel: "Operator B" },
    { title: "Ferris Wheel", rideLabel: "Ferris wheel", miles: 39, thumb: null, operatorLabel: "Operator C" },
  ],
  nearby: [
    { label: "giant Ferris wheels", operators: 3 },
    { label: "mini Ferris wheels", operators: 4 },
  ],
  product: { name: "Ferris Wheel Event Access", price: "$199", unlockLimit: 5, validityDays: 30 },
  pass: { unlockLimit: 5, expiresOn: "Friday, November 13, 2026" },
  ctaUrl: "https://carnivalriderental.us/connect/00000000-0000-4000-8000-000000000000",
  unsubscribeUrl: "https://carnivalriderental.us/api/email/unsubscribe?e=customer%40example.com&t=sample",
  postalAddress: "[BUSINESS_POSTAL_ADDRESS: required before commercial emails can send]",
  intro: null,
};
const rows: string[] = [];
for (const t of LIFECYCLE_TEMPLATES) {
  const r = renderLifecycle(t, sample);
  fs.writeFileSync(path.join(out, `${t}.html`), r.html);
  fs.writeFileSync(path.join(out, `${t}.txt`), `Subject: ${r.subject}\n\n${r.text}\n`);
  rows.push(`<tr><td><a href="${t}.html">${t}</a></td><td>${TEMPLATE_KIND[t]}</td><td>${r.subject.replace(/</g, "&lt;")}</td></tr>`);
}
fs.writeFileSync(path.join(out, "index.html"), `<!doctype html><meta charset="utf-8"><title>Lifecycle email previews</title><body style="font-family:system-ui;max-width:900px;margin:32px auto"><h1>Lifecycle email previews</h1><p>Sample data. Commercial templates send only with an approved campaign and a postal address.</p><table cellpadding="6">${rows.join("")}</table></body>`);
console.log(`Wrote ${LIFECYCLE_TEMPLATES.length} previews to ${out}`);
