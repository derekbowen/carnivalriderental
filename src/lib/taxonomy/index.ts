import { z } from "zod";
import { CATEGORY_IDS, EVENT_TYPE_IDS } from "../contract";
import occasionsJson from "./occasions.json";
import rideTypesJson from "./ride-types.json";

export * from "./states";

/**
 * pSEO taxonomies: the dimensions page families are generated from (occasion, ride type, state).
 * They are SEARCH TARGETS, not inventory. Supply shown on a page always comes from the live
 * catalog (src/lib/catalog); a taxonomy entry alone never makes a page indexable.
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const reviewStatus = z.enum(["draft", "approved"]);
const category = z.string().refine((c) => CATEGORY_IDS.includes(c), "unknown category");

const faq = z.object({ q: z.string().min(5), a: z.string().min(20) });

const occasion = z
  .object({
    id: z.string().regex(SLUG),
    name: z.string().min(2),
    plural: z.string().min(2),
    group: z.string(),
    eventType: z.string().refine((e) => EVENT_TYPE_IDS.includes(e), "unknown contract eventType"),
    guestFocus: z.enum(["children", "teens", "adults", "families", "all-ages"]),
    suggestedCategories: z.array(category).min(1),
    searchPhrases: z.array(z.string().min(3)).min(1),
    intro: z.string().min(40).max(400),
    related: z.array(z.string().regex(SLUG)),
    reviewStatus,
  })
  .strict();

const occasionsFile = z.object({
  version: z.string(),
  status: z.string(),
  rules: z.array(z.string()),
  commonFaq: z.array(faq).min(1),
  groups: z.array(z.object({ id: z.string().regex(SLUG), name: z.string(), planningNotes: z.array(z.string().min(10)).min(1) }).strict()),
  occasions: z.array(occasion).min(50).max(75),
});

const rideType = z
  .object({
    id: z.string().regex(SLUG),
    name: z.string().min(2),
    categoryId: category,
    priority: z.number().int().positive(),
    searchPhrases: z.array(z.string().min(3)).min(1),
    reviewStatus,
  })
  .strict();

const rideTypesFile = z.object({ version: z.string(), status: z.string(), rules: z.array(z.string()), rideTypes: z.array(rideType).min(1) });

export type Occasion = z.infer<typeof occasion>;
export type OccasionGroup = z.infer<typeof occasionsFile>["groups"][number];
export type RideType = z.infer<typeof rideType>;
export type Faq = z.infer<typeof faq>;

/** Cross-record checks zod can't express. Returns problems; empty = valid. */
export function checkTaxonomies(o: z.infer<typeof occasionsFile>, r: z.infer<typeof rideTypesFile>): string[] {
  const errs: string[] = [];
  const dupes = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i);
  for (const d of dupes(o.occasions.map((x) => x.id))) errs.push(`duplicate occasion id ${d}`);
  for (const d of dupes(r.rideTypes.map((x) => x.id))) errs.push(`duplicate ride type id ${d}`);
  for (const d of dupes(r.rideTypes.map((x) => String(x.priority)))) errs.push(`duplicate ride type priority ${d}`);
  const groups = new Set(o.groups.map((g) => g.id));
  const ids = new Set(o.occasions.map((x) => x.id));
  for (const x of o.occasions) {
    if (!groups.has(x.group)) errs.push(`occasion ${x.id}: unknown group ${x.group}`);
    for (const rel of x.related) if (!ids.has(rel) || rel === x.id) errs.push(`occasion ${x.id}: bad related ${rel}`);
  }
  return errs;
}

function load() {
  const o = occasionsFile.parse(occasionsJson);
  const r = rideTypesFile.parse(rideTypesJson);
  const errs = checkTaxonomies(o, r);
  if (errs.length) throw new Error(`Taxonomy check failed:\n- ${errs.join("\n- ")}`);
  return { o, r };
}

const { o: OCC, r: RIDES } = load();

export const OCCASIONS: Occasion[] = OCC.occasions;
export const OCCASION_GROUPS: OccasionGroup[] = OCC.groups;
export const COMMON_FAQ: Faq[] = OCC.commonFaq;
export const RIDE_TYPES: RideType[] = [...RIDES.rideTypes].sort((a, b) => a.priority - b.priority);

export const occasionById = (id: string) => OCCASIONS.find((x) => x.id === id);
export const groupOf = (x: Occasion) => OCCASION_GROUPS.find((g) => g.id === x.group)!;
export const rideTypeById = (id: string) => RIDE_TYPES.find((x) => x.id === id);

/** Exposed for tests (schema negatives). */
export const schemas = { occasion, occasionsFile, rideType, rideTypesFile };
