/**
 * Classifies rides the matcher left unassigned (read-only; writes reports/inventory-unmatched.json).
 *   npm run inventory:unmatched
 *
 * Buckets (nothing here changes a ride's type; suggestions need human review before a matcher rule
 * is added, and a rule is added only when the name reliably identifies the ride model):
 *   - likelyAlias: a recognised industry or model name for one of the 50 canonical types
 *   - outsideTaxonomy: a recognised ride model with no canonical type (e.g. Rock-O-Plane, Octopus)
 *   - notARide: inflatables, games, climbing walls, mechanical bulls
 *   - ambiguous: a marketing or brand name with no reliable type signal
 */
import fs from "node:fs";
import { RIDES } from "../src/lib/inventory";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

const ALIAS: [RegExp, string][] = [
  [/^(the )?(lone star )?scooters?$|bumper/, "bumper-cars"],
  [/dizzy dragons?|tubs? of fun|tea ?cup|fruit cup|spinning berry/, "spinning-teacups"],
  [/^round ?up$/, "round-up"],
  [/orient express|go gator|wacky worm|wiggle wu?rm|dragon wagon|mighty mac|monkey mayhem|critter track/, "kiddie-coaster"],
  [/super shot|mega drop|free ?fall/, "drop-tower"],
  [/pharaoh?s? s? fury|pharoah s fury|sea ray|ships ahoy|flying dutchman/, "swinging-pirate-ship"],
  [/fire ?ball/, "pendulum-ride"],
  [/red baron|sky ?fighter|flying tigers|air show|top gun|squadron|looney airport/, "kiddie-jets"],
  [/hampton|jalopy junction|crazy cabs|vw bugs|granny bugs|hot rods|baja bugg|dune bugg|beach buggy|convoy|groovy bus|crazy bus|fire chief|farm tractors|^tractors$|quad ?runners?|mini indy|rock n cars|cruisin classics|construction zone/, "kiddie-cars"],
  [/musical chairs|wave runner|wind jammer/, "chair-swing-ride"],
  [/mardi gras|funny farm|fun zone|crystal lils/, "fun-house"],
  [/hog wild|hog rally/, "kiddie-motorcycles"],
  [/rockin tug|rock n tug|wet boats|happy pond/, "kiddie-boats"],
  [/mini disco|^disco$/, "tilt-ride"],
];
const OUTSIDE = /rock o plane|loop o plane|^spider|spider mania|octopus|enterprise|polar express|himalaya|cliff ?hanger|hang glider|kite flyer|sky diver|tip top|trabant|wipe ?out|ali baba|tempest|hi(gh)? roller|avalanche|gee whiz|star dancer|samba|crazy dance|bear affair|puppy roll|puppy love|flying elephants|jumbo|elephants|whale|moby dick|bumble ?bees?|^bees$|lady ?bugs?|flying saucers|up up away|flying bobs|alpine bobs|silver streak|astroliner|euro bungee|catch n air|mechanical (shark|unicorn)/;
const NOT_RIDE = /bounce|inflatable|jump around|mechanical bull|rock (climb|wall)|obstacle course|casino|slime buckets|face to face race/;

type Bucket = "likelyAlias" | "outsideTaxonomy" | "notARide" | "ambiguous";
const rows = RIDES.filter((r) => !r.rideType).map((r) => {
  const t = norm(r.title);
  if (NOT_RIDE.test(t)) return { title: r.title, rideClass: r.rideClass, bucket: "notARide" as Bucket, suggested: null };
  const a = ALIAS.find(([re]) => re.test(t));
  if (a) return { title: r.title, rideClass: r.rideClass, bucket: "likelyAlias" as Bucket, suggested: a[1] };
  if (OUTSIDE.test(t)) return { title: r.title, rideClass: r.rideClass, bucket: "outsideTaxonomy" as Bucket, suggested: null };
  return { title: r.title, rideClass: r.rideClass, bucket: "ambiguous" as Bucket, suggested: null };
});

const count = (b: Bucket) => rows.filter((r) => r.bucket === b).length;
const titles = (b: Bucket, n = 60) => {
  const m = new Map<string, number>();
  for (const r of rows.filter((x) => x.bucket === b)) m.set(r.title, (m.get(r.title) ?? 0) + 1);
  return [...m].sort((a, b2) => b2[1] - a[1]).slice(0, n).map(([t, c]) => `${t} (${c})`);
};
const bySuggested: Record<string, number> = {};
for (const r of rows) if (r.suggested) bySuggested[r.suggested] = (bySuggested[r.suggested] ?? 0) + 1;

const out = {
  generatedFrom: "src/lib/inventory/rides.json",
  note: "Suggestions are for review only. No ride type has been changed.",
  unmatched: rows.length,
  counts: { likelyAlias: count("likelyAlias"), outsideTaxonomy: count("outsideTaxonomy"), notARide: count("notARide"), ambiguous: count("ambiguous") },
  likelyAliasBySuggestedType: Object.fromEntries(Object.entries(bySuggested).sort((a, b) => b[1] - a[1])),
  topTitles: { likelyAlias: titles("likelyAlias"), outsideTaxonomy: titles("outsideTaxonomy"), notARide: titles("notARide"), ambiguous: titles("ambiguous", 80) },
  rows,
};
fs.mkdirSync("reports", { recursive: true });
fs.writeFileSync("reports/inventory-unmatched.json", `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({ unmatched: out.unmatched, counts: out.counts, likelyAliasBySuggestedType: out.likelyAliasBySuggestedType }, null, 2));
