import manifest from "../../../contract/listing-contract.json";

/**
 * The listing data contract, loaded from contract/listing-contract.json.
 *
 * validateOfferingRecord() checks STRUCTURE only (keys, types, options, cross-field rules).
 * It cannot know whether a value is true. Truthfulness gates (provenance for estimates,
 * publishability) live in src/lib/catalog, which also re-validates every record READ from
 * Sharetribe, because Console edits never pass through this validator.
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
  consoleExpect?: { console: boolean; scope: string; schemaType: string; indexForSearch: boolean; consoleType?: string };
}

export const CONTRACT = manifest;
export const CONTRACT_VERSION: string = manifest.contractVersion;
export const LISTING_TYPE_ID: string = manifest.listingTypes[0].id;
export const PROCESS_BINDING = manifest.processBinding;
export const CATEGORY_IDS: string[] = manifest.categories.items.map((c) => c.id);
export const FIELDS = manifest.fields as ContractField[];
export const US_STATE_CODES: string[] = manifest.optionSets.usStates.values;
export const EVENT_TYPE_IDS: string[] = manifest.optionSets.eventTypes.values;

export function optionValues(field: ContractField): string[] {
  if (field.options) return field.options.map((o) => o.option);
  if (field.optionsRef) return manifest.optionSets[field.optionsRef].values;
  return [];
}

export function optionLabel(fieldKey: string, value: string): string {
  const f = FIELDS.find((x) => x.key === fieldKey);
  return f?.options?.find((o) => o.option === value)?.label ?? value;
}

function conditionHolds(cond: string | undefined, metadata: Record<string, unknown>): boolean {
  if (!cond) return false;
  const m = cond.match(/^(\w+)\s*=\s*([\w-]+)$/);
  if (!m) throw new Error(`Unsupported contract condition: ${cond}`);
  return metadata[m[1]] === m[2];
}

/** The full intended state of a listing (for updates: the existing record merged with the patch). */
export interface OfferingRecord {
  title: string;
  description: string;
  publicData: Record<string, unknown>;
  metadata: Record<string, unknown>;
  privateData?: Record<string, unknown>;
  geolocation?: unknown;
  price?: unknown;
  availabilityPlan?: unknown;
}
/** @deprecated name kept for callers; validates a full record, not a patch. */
export type OfferingWrite = OfferingRecord;

/** Structural validation of a full offering record. Returns violations (empty = structurally valid). */
export function validateOfferingRecord(w: OfferingRecord): string[] {
  const errs: string[] = [];
  if (!w.title?.trim()) errs.push("title is required");
  if (!w.description?.trim()) errs.push("description is required");
  if (w.geolocation != null) errs.push("geolocation must not be set on offerings (implies physical location)");
  if (w.price != null) errs.push("price is not used in contract v1");
  if (w.availabilityPlan != null) errs.push("availabilityPlan is not used (offerings are not single bookable units)");
  if (w.privateData && Object.keys(w.privateData).length) errs.push("privateData is not used by the contract");

  const pd = w.publicData ?? {};
  const fixed: Record<string, string> = {
    listingType: LISTING_TYPE_ID,
    transactionProcessAlias: PROCESS_BINDING.transactionProcess.alias,
    unitType: PROCESS_BINDING.unitType,
  };
  for (const [k, v] of Object.entries(fixed)) if (pd[k] !== v) errs.push(`publicData.${k} must be "${v}"`);
  if (!CATEGORY_IDS.includes(pd.categoryLevel1 as string)) errs.push(`publicData.categoryLevel1 must be one of ${CATEGORY_IDS.join(", ")}`);
  for (const k of Object.keys(pd)) if (!(k in fixed) && k !== "categoryLevel1") errs.push(`publicData.${k} is not in the contract`);

  const md = w.metadata ?? {};
  const known = new Set(FIELDS.map((f) => f.key));
  for (const k of Object.keys(md)) if (!known.has(k)) errs.push(`metadata.${k} is not in the contract`);

  for (const f of FIELDS) {
    const v = md[f.key];
    const present = v !== undefined && v !== null;
    const required = f.required || conditionHolds(f.requiredWhen, md);
    if (conditionHolds(f.forbiddenWhen, md) && present) {
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
  if (md.offeringScope === "specific-model") errs.push("offeringScope specific-model needs the deferred model/spec fields (not approved yet)");
  const lo = md.estimateLowUsd as number | undefined;
  const hi = md.estimateHighUsd as number | undefined;
  if (Number.isInteger(lo) && Number.isInteger(hi) && (hi as number) < (lo as number)) errs.push("metadata.estimateHighUsd must be >= estimateLowUsd");
  return errs;
}
/** @deprecated use validateOfferingRecord (same function; validates the full resulting record). */
export const validateOfferingWrite = validateOfferingRecord;

/** For updates: merge the patch into the existing record, then validate the RESULT. */
export function mergeOfferingPatch(existing: OfferingRecord, patch: Partial<OfferingRecord>): OfferingRecord {
  const merge = (a: Record<string, unknown> = {}, b?: Record<string, unknown>) => {
    if (!b) return { ...a };
    const out = { ...a };
    // Sharetribe semantics: top-level keys merge; a null value removes the key.
    for (const [k, v] of Object.entries(b)) (v === null ? delete out[k] : (out[k] = v));
    return out;
  };
  return {
    ...existing,
    ...patch,
    publicData: merge(existing.publicData, patch.publicData),
    metadata: merge(existing.metadata, patch.metadata),
    privateData: merge(existing.privateData, patch.privateData),
  };
}

/* ---------------- configuration verification against a captured snapshot ---------------- */

interface AssetSnap {
  status: string;
  data?: Record<string, unknown> | null;
}
export interface SharetribeSnapshot {
  marketplaceName: string | null;
  assets: Record<string, AssetSnap>;
}

export type CheckStatus = "match" | "drift" | "unverified";
export interface ConfigCheck {
  id: string;
  status: CheckStatus;
  expected: unknown;
  actual: unknown;
  note?: string;
}
export interface VerificationReport {
  checks: ConfigCheck[];
  counts: Record<CheckStatus, number>;
  /** True only when EVERY check matched. Unverified or drifting checks make this false. */
  fullyVerified: boolean;
  /** Properties this checker cannot see at all. A clean report says nothing about them. */
  outOfCoverage: string[];
}

/**
 * Encodings we have actually observed in a real asset (or that Sharetribe documents). Anything
 * else is reported as UNVERIFIED when it differs, never as a match. Update when observed.
 */
export const CONFIRMED_ENCODINGS = {
  fieldScopes: ["public"], // "metadata" spelling not yet observed in an asset
  schemaTypes: ["enum", "multi-enum", "long"], // documented Console mappings; text encoding unconfirmed
  categoriesAsset: false, // no category has existed yet in any environment we read
  mainSearchTypes: ["location"], // only "location" observed; keyword spelling unconfirmed
  customerCommissionPath: false, // only providerCommission observed
};

function get(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
}

export function verifyConfiguration(snap: SharetribeSnapshot): VerificationReport {
  const checks: ConfigCheck[] = [];
  const add = (c: ConfigCheck) => checks.push(c);
  const asset = (p: string) => snap.assets[p];
  const readable = (p: string) => asset(p)?.status === "ok";

  /** Compare with awareness of whether the expected encoding has been observed. */
  const cmp = (id: string, expected: unknown, actual: unknown, confirmed: boolean, note?: string) => {
    if (actual === undefined) return add({ id, status: "unverified", expected, actual, note: note ?? "property not present / not readable" });
    if (actual === expected) return add({ id, status: "match", expected, actual, note });
    add({ id, status: confirmed ? "drift" : "unverified", expected, actual, note: confirmed ? note : `${note ? note + "; " : ""}expected encoding not yet observed — cannot call this drift or a match` });
  };

  // Listing type + process binding
  if (!readable("listings/listing-types.json")) add({ id: "listingTypes", status: "unverified", expected: LISTING_TYPE_ID, actual: undefined, note: "asset not readable" });
  else {
    const types = (asset("listings/listing-types.json")!.data?.listingTypes as Record<string, unknown>[] | undefined) ?? [];
    const lt = types.find((t) => t.id === LISTING_TYPE_ID);
    if (!lt) add({ id: `listingType:${LISTING_TYPE_ID}`, status: "drift", expected: "present", actual: "missing" });
    else {
      cmp(`listingType:${LISTING_TYPE_ID}.processAlias`, PROCESS_BINDING.transactionProcess.alias, get(lt, "transactionProcess.alias"), true, "binding is a temporary Test scaffold");
      cmp(`listingType:${LISTING_TYPE_ID}.unitType`, PROCESS_BINDING.unitType, lt.unitType, true);
    }
    for (const t of types) if (t.id !== LISTING_TYPE_ID) add({ id: `listingType:${t.id}`, status: "drift", expected: "absent (retired)", actual: `present (${get(t, "transactionProcess.alias")})` });
  }

  // Categories
  const cat = asset("listings/listing-categories.json");
  if (!cat || cat.status !== "ok") {
    for (const c of manifest.categories.items) add({ id: `category:${c.id}`, status: cat?.status === "not-configured" ? "drift" : "unverified", expected: "present", actual: cat?.status ?? "unreadable" });
  } else {
    const list = get(cat.data, "categories");
    if (!Array.isArray(list)) {
      for (const c of manifest.categories.items) add({ id: `category:${c.id}`, status: "unverified", expected: "present", actual: "unrecognised asset format", note: "categories asset format not confirmed" });
    } else {
      const ids = list.map((c) => (c as { id?: string }).id);
      for (const c of manifest.categories.items) {
        const present = ids.includes(c.id);
        add({ id: `category:${c.id}`, status: present ? "match" : "drift", expected: "present", actual: present ? "present" : "missing", note: CONFIRMED_ENCODINGS.categoriesAsset ? undefined : "format inferred from first real asset" });
      }
      for (const id of ids) if (!CATEGORY_IDS.includes(id as string)) add({ id: `category:${id}`, status: "drift", expected: "absent", actual: "present (not in contract)" });
    }
  }

  // Listing fields: behaviour-controlling properties
  if (!readable("listings/listing-fields.json")) add({ id: "listingFields", status: "unverified", expected: "readable", actual: undefined });
  else {
    const fields = (asset("listings/listing-fields.json")!.data?.listingFields as Record<string, unknown>[] | undefined) ?? [];
    for (const f of FIELDS.filter((x) => x.consoleExpect?.console && x.createInPhase.startsWith("1"))) {
      const a = fields.find((x) => x.key === f.key);
      const e = f.consoleExpect!;
      if (!a) {
        add({ id: `field:${f.key}`, status: "drift", expected: "present", actual: "missing" });
        continue;
      }
      cmp(`field:${f.key}.scope`, e.scope, a.scope, CONFIRMED_ENCODINGS.fieldScopes.includes(e.scope));
      cmp(`field:${f.key}.schemaType`, e.schemaType, a.schemaType, CONFIRMED_ENCODINGS.schemaTypes.includes(e.schemaType), e.consoleType ? `Console type: ${e.consoleType}` : undefined);
      const idx = get(a, "filterConfig.indexForSearch");
      cmp(`field:${f.key}.indexForSearch`, e.indexForSearch, idx === undefined ? false : idx, true, "absent filterConfig treated as not indexed");
      const want = optionValues(f);
      if (want.length) {
        const have = ((a.enumOptions as { option: string }[] | undefined) ?? []).map((o) => o.option);
        const same = want.length === have.length && want.every((o) => have.includes(o));
        add({ id: `field:${f.key}.options`, status: same ? "match" : "drift", expected: want.length, actual: have.length, note: same ? undefined : `missing [${want.filter((o) => !have.includes(o)).join(",")}] extra [${have.filter((o) => !want.includes(o)).join(",")}]` });
      }
    }
    for (const a of fields) if (!FIELDS.some((f) => f.key === a.key)) add({ id: `field:${a.key as string}`, status: "drift", expected: "absent", actual: `present (${a.scope} ${a.schemaType})` });
  }

  // Search + commission settings
  const exp = manifest.searchConfiguration.expect as Record<string, Record<string, unknown>>;
  for (const [path, props] of Object.entries(exp)) {
    const a = asset(path);
    for (const [prop, expected] of Object.entries(props)) {
      const id = `${path.split("/").pop()}:${prop}`;
      if (!a || a.status !== "ok") {
        add({ id, status: "unverified", expected, actual: a?.status ?? "unreadable" });
        continue;
      }
      const actual = get(a.data, prop);
      // A difference is DRIFT when either side is an encoding we have observed (e.g. actual
      // "location" is known and is not keyword search). Otherwise it stays UNVERIFIED.
      const confirmed =
        prop === "mainSearch.searchType"
          ? CONFIRMED_ENCODINGS.mainSearchTypes.includes(expected as string) || CONFIRMED_ENCODINGS.mainSearchTypes.includes(actual as string)
          : prop.startsWith("customerCommission") ? CONFIRMED_ENCODINGS.customerCommissionPath
          : true;
      cmp(id, expected, actual, confirmed);
    }
  }

  const counts = { match: 0, drift: 0, unverified: 0 } as Record<CheckStatus, number>;
  for (const c of checks) counts[c.status]++;
  return {
    checks,
    counts,
    fullyVerified: checks.length > 0 && counts.drift === 0 && counts.unverified === 0,
    outOfCoverage: manifest.searchConfiguration.outOfCoverage,
  };
}

/** @deprecated kept for older callers: drift-only view of verifyConfiguration. */
export function diffAgainstSnapshot(snap: SharetribeSnapshot) {
  return verifyConfiguration(snap).checks.filter((c) => c.status !== "match");
}
