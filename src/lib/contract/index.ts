import manifest from "../../../contract/listing-contract.json";

/**
 * The listing data contract, loaded from contract/listing-contract.json.
 * Every write path (seed, import, admin tools) validates through validateOfferingWrite();
 * no component defines its own field IDs or option lists.
 */
export type FieldType = "shortText" | "text" | "enum" | "multi-enum" | "long" | "boolean";

export interface ContractField {
  key: string;
  label: string;
  meaning: string;
  consoleField: boolean;
  scope: "metadata" | "public" | "private";
  type: FieldType;
  options?: { option: string; label: string }[];
  optionsRef?: keyof typeof manifest.optionSets;
  pattern?: string;
  unit?: string;
  min?: number;
  maxLength?: number;
  minItems?: number;
  required: boolean;
  requiredWhen?: string;
  forbiddenWhen?: string;
  createInPhase: string;
}

export const CONTRACT = manifest;
export const CONTRACT_VERSION: string = manifest.contractVersion;
export const LISTING_TYPE = manifest.listingTypes[0];
export const CATEGORY_IDS: string[] = manifest.categories.items.map((c) => c.id);
export const FIELDS = manifest.fields as ContractField[];

export function optionValues(field: ContractField): string[] {
  if (field.options) return field.options.map((o) => o.option);
  if (field.optionsRef) return manifest.optionSets[field.optionsRef].values;
  return [];
}

export const US_STATE_CODES: string[] = manifest.optionSets.usStates.values;
export const EVENT_TYPE_IDS: string[] = manifest.optionSets.eventTypes.values;

/** Parses conditions of the form "key = value". */
function conditionHolds(cond: string | undefined, metadata: Record<string, unknown>): boolean {
  if (!cond) return false;
  const m = cond.match(/^(\w+)\s*=\s*([\w-]+)$/);
  if (!m) throw new Error(`Unsupported contract condition: ${cond}`);
  return metadata[m[1]] === m[2];
}

export interface OfferingWrite {
  title: string;
  description: string;
  publicData: Record<string, unknown>;
  metadata: Record<string, unknown>;
  privateData?: Record<string, unknown>;
  geolocation?: unknown;
  price?: unknown;
  availabilityPlan?: unknown;
}

/** Validate a listing write against the contract. Returns a list of violations (empty = valid). */
export function validateOfferingWrite(w: OfferingWrite): string[] {
  const errs: string[] = [];
  if (!w.title?.trim()) errs.push("title is required");
  if (!w.description?.trim()) errs.push("description is required");
  if (w.geolocation != null) errs.push("geolocation must not be set on offerings (implies physical location)");
  if (w.price != null) errs.push("price is not used in contract v1");
  if (w.availabilityPlan != null) errs.push("availabilityPlan is not used (offerings are not single bookable units)");
  if (w.privateData && Object.keys(w.privateData).length) errs.push("privateData is not used by the contract");

  // Native publicData keys: fixed values + category, and nothing else.
  const pd = w.publicData ?? {};
  const fixed: Record<string, string> = {};
  for (const a of manifest.nativeAttributes) {
    if ("fixedValue" in a && a.path.startsWith("publicData.")) fixed[a.path.slice("publicData.".length)] = a.fixedValue as string;
  }
  for (const [k, v] of Object.entries(fixed)) if (pd[k] !== v) errs.push(`publicData.${k} must be "${v}"`);
  if (!CATEGORY_IDS.includes(pd.categoryLevel1 as string)) errs.push(`publicData.categoryLevel1 must be one of ${CATEGORY_IDS.join(", ")}`);
  for (const k of Object.keys(pd)) {
    if (!(k in fixed) && k !== "categoryLevel1") errs.push(`publicData.${k} is not in the contract`);
  }

  // Contract fields (all metadata in v1).
  const md = w.metadata ?? {};
  const known = new Set(FIELDS.map((f) => f.key));
  for (const k of Object.keys(md)) if (!known.has(k)) errs.push(`metadata.${k} is not in the contract`);

  for (const f of FIELDS) {
    const v = md[f.key];
    const present = v !== undefined && v !== null;
    const required = f.required || conditionHolds(f.requiredWhen, md);
    const forbidden = conditionHolds(f.forbiddenWhen, md);
    if (forbidden && present) {
      errs.push(`metadata.${f.key} must be omitted when ${f.forbiddenWhen}`);
      continue;
    }
    if (!present) {
      if (required) errs.push(`metadata.${f.key} is required${f.requiredWhen ? ` when ${f.requiredWhen}` : ""}`);
      continue;
    }
    switch (f.type) {
      case "shortText":
      case "text":
        if (typeof v !== "string" || !v.trim()) errs.push(`metadata.${f.key} must be a non-empty string`);
        else if (f.pattern && !new RegExp(f.pattern).test(v)) errs.push(`metadata.${f.key} does not match ${f.pattern}`);
        else if (f.maxLength && v.length > f.maxLength) errs.push(`metadata.${f.key} exceeds ${f.maxLength} characters`);
        break;
      case "long":
        if (!Number.isInteger(v)) errs.push(`metadata.${f.key} must be an integer${f.unit ? ` (${f.unit})` : ""}`);
        else if (f.min !== undefined && (v as number) < f.min) errs.push(`metadata.${f.key} must be >= ${f.min}`);
        break;
      case "enum":
        if (!optionValues(f).includes(v as string)) errs.push(`metadata.${f.key} must be one of ${optionValues(f).join(", ")}`);
        break;
      case "multi-enum": {
        const allowed = optionValues(f);
        if (!Array.isArray(v)) errs.push(`metadata.${f.key} must be an array`);
        else {
          if (f.minItems && v.length < f.minItems) errs.push(`metadata.${f.key} needs at least ${f.minItems} value(s)`);
          const bad = v.filter((x) => !allowed.includes(x as string));
          if (bad.length) errs.push(`metadata.${f.key} has invalid values: ${bad.join(", ")}`);
          if (new Set(v).size !== v.length) errs.push(`metadata.${f.key} has duplicate values`);
        }
        break;
      }
      case "boolean":
        if (typeof v !== "boolean") errs.push(`metadata.${f.key} must be a boolean`);
        break;
    }
  }

  const lo = md.estimateLowUsd as number | undefined;
  const hi = md.estimateHighUsd as number | undefined;
  if (Number.isInteger(lo) && Number.isInteger(hi) && (hi as number) < (lo as number)) errs.push("metadata.estimateHighUsd must be >= estimateLowUsd");
  return errs;
}

/* ---------------- drift detection against a captured Sharetribe snapshot ---------------- */

interface AssetSnap {
  status: string;
  data?: Record<string, unknown> | null;
}
export interface SharetribeSnapshot {
  marketplaceName: string | null;
  assets: Record<string, AssetSnap>;
}

export interface DriftItem {
  kind: "missing" | "unexpected" | "mismatch";
  what: string;
  detail: string;
}

/** Compare the contract (phase-1 items) with the actual hosted configuration. */
export function diffAgainstSnapshot(snap: SharetribeSnapshot, phase = "1"): DriftItem[] {
  const out: DriftItem[] = [];
  const inPhase = (p: string) => p === phase || p.startsWith(`${phase} `);

  const types = (snap.assets["listings/listing-types.json"]?.data?.listingTypes as { id: string; transactionProcess?: { alias?: string }; unitType?: string }[] | undefined) ?? [];
  for (const lt of manifest.listingTypes) {
    const actual = types.find((t) => t.id === lt.id);
    if (!actual) out.push({ kind: "missing", what: `listing type ${lt.id}`, detail: `create with process ${lt.transactionProcess.alias}, unit ${lt.unitType}` });
    else {
      if (actual.transactionProcess?.alias !== lt.transactionProcess.alias) out.push({ kind: "mismatch", what: `listing type ${lt.id}`, detail: `process ${actual.transactionProcess?.alias} ≠ ${lt.transactionProcess.alias}` });
      if (actual.unitType !== lt.unitType) out.push({ kind: "mismatch", what: `listing type ${lt.id}`, detail: `unitType ${actual.unitType} ≠ ${lt.unitType}` });
    }
  }
  for (const t of types) if (!manifest.listingTypes.some((lt) => lt.id === t.id)) out.push({ kind: "unexpected", what: `listing type ${t.id}`, detail: `process ${t.transactionProcess?.alias}; not in contract` });

  // NOTE: the categories asset shape ({ categories: [{ id, name, subcategories }] }) is assumed until
  // the first category exists in Test; re-run inspect + diff after creating categories to confirm.
  const catAsset = snap.assets["listings/listing-categories.json"];
  const cats = ((catAsset?.data?.categories as { id: string }[] | undefined) ?? []).map((c) => c.id);
  for (const c of manifest.categories.items) if (inPhase(c.createInPhase) && !cats.includes(c.id)) out.push({ kind: "missing", what: `category ${c.id}`, detail: c.label });
  for (const id of cats) if (!CATEGORY_IDS.includes(id)) out.push({ kind: "unexpected", what: `category ${id}`, detail: "not in contract" });

  const fields = (snap.assets["listings/listing-fields.json"]?.data?.listingFields as { key: string; scope: string; schemaType: string; enumOptions?: { option: string }[] }[] | undefined) ?? [];
  for (const f of FIELDS.filter((f) => f.consoleField && inPhase(f.createInPhase))) {
    const a = fields.find((x) => x.key === f.key);
    if (!a) {
      out.push({ kind: "missing", what: `listing field ${f.key}`, detail: `${f.scope} ${f.type}` });
      continue;
    }
    if (a.scope !== f.scope) out.push({ kind: "mismatch", what: `listing field ${f.key}`, detail: `scope ${a.scope} ≠ ${f.scope}` });
    // Console stores both single-line and long text as a text schema; treat them as one family.
    const textFamily = (t: string) => (t === "shortText" || t === "text" ? "text" : t);
    if (textFamily(a.schemaType) !== textFamily(f.type)) out.push({ kind: "mismatch", what: `listing field ${f.key}`, detail: `type ${a.schemaType} ≠ ${f.type}` });
    const want = optionValues(f);
    if (want.length) {
      const have = (a.enumOptions ?? []).map((o) => o.option);
      const missing = want.filter((o) => !have.includes(o));
      const extra = have.filter((o) => !want.includes(o));
      if (missing.length || extra.length) out.push({ kind: "mismatch", what: `listing field ${f.key} options`, detail: `missing [${missing.join(",")}] extra [${extra.join(",")}]` });
    }
  }
  for (const a of fields) if (!FIELDS.some((f) => f.key === a.key)) out.push({ kind: "unexpected", what: `listing field ${a.key}`, detail: `${a.scope} ${a.schemaType}; not in contract` });
  return out;
}
