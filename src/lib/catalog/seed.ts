import { LISTING_TYPE_ID, mergeOfferingPatch, PROCESS_BINDING, validateOfferingRecord, type OfferingRecord } from "../contract";

/**
 * Seed planning for catalog listings. Pure: takes current state, returns actions or errors.
 * Guarantees:
 *  - offerKey is unique among existing listings (duplicates abort the whole plan);
 *  - offerKey never changes for a listing we created (the id→offerKey map must still hold);
 *  - updates validate the MERGED resulting record, not the patch;
 *  - re-running with no changes produces only no-ops (idempotent).
 */
export interface ExistingListing {
  id: string;
  title: string;
  description: string;
  state: string;
  publicData: Record<string, unknown>;
  metadata: Record<string, unknown>;
}
export interface SeedSample {
  title: string;
  description: string;
  publicData: Record<string, unknown>;
  metadata: Record<string, unknown>;
}
export type SeedAction =
  | { kind: "create"; offerKey: string; record: OfferingRecord }
  | { kind: "update"; offerKey: string; listingId: string; patch: Partial<OfferingRecord>; result: OfferingRecord }
  | { kind: "noop"; offerKey: string; listingId: string };

export function withBinding(s: SeedSample): OfferingRecord {
  return {
    title: s.title,
    description: s.description,
    publicData: { ...s.publicData, listingType: LISTING_TYPE_ID, transactionProcessAlias: PROCESS_BINDING.transactionProcess.alias, unitType: PROCESS_BINDING.unitType },
    metadata: { ...s.metadata },
  };
}

const stable = (v: unknown) => JSON.stringify(v, Object.keys((v ?? {}) as object).sort());

export function planSeed(input: { existing: ExistingListing[]; map: Record<string, string>; samples: SeedSample[] }): { actions: SeedAction[]; errors: string[] } {
  const errors: string[] = [];
  const byKey = new Map<string, ExistingListing>();
  for (const l of input.existing) {
    const k = l.metadata.offerKey;
    if (typeof k !== "string") continue;
    if (byKey.has(k)) errors.push(`duplicate offerKey ${k} on listings ${byKey.get(k)!.id} and ${l.id}`);
    else byKey.set(k, l);
  }
  // The map records what we created; it must still agree with Sharetribe.
  for (const [k, id] of Object.entries(input.map)) {
    const l = input.existing.find((x) => x.id === id);
    if (!l) errors.push(`mapped listing ${id} for ${k} no longer exists`);
    else if (l.metadata.offerKey !== k) errors.push(`offerKey of listing ${id} changed from ${k} to ${String(l.metadata.offerKey)} outside the seed path`);
  }
  const sampleKeys = input.samples.map((s) => s.metadata.offerKey as string);
  for (const k of sampleKeys) if (sampleKeys.indexOf(k) !== sampleKeys.lastIndexOf(k)) errors.push(`sample file repeats offerKey ${k}`);

  const actions: SeedAction[] = [];
  for (const s of input.samples) {
    const desired = withBinding(s);
    const key = desired.metadata.offerKey as string;
    const existing = byKey.get(key);
    if (input.map[key] && existing && input.map[key] !== existing.id) {
      errors.push(`${key} is mapped to ${input.map[key]} but found on ${existing.id}`);
      continue;
    }
    if (!existing) {
      const v = validateOfferingRecord(desired);
      if (v.length) errors.push(`${key}: ${v.join("; ")}`);
      else actions.push({ kind: "create", offerKey: key, record: desired });
      continue;
    }
    const current: OfferingRecord = { title: existing.title, description: existing.description, publicData: existing.publicData, metadata: existing.metadata };
    // Remove keys that the desired record no longer has (null = delete in Sharetribe merge semantics).
    const removals = (cur: Record<string, unknown>, want: Record<string, unknown>) =>
      Object.fromEntries(Object.keys(cur).filter((k) => !(k in want)).map((k) => [k, null]));
    const patch: Partial<OfferingRecord> = {
      title: desired.title,
      description: desired.description,
      publicData: { ...removals(current.publicData, desired.publicData), ...desired.publicData },
      metadata: { ...removals(current.metadata, desired.metadata), ...desired.metadata },
    };
    const result = mergeOfferingPatch(current, patch);
    const v = validateOfferingRecord(result);
    if (v.length) {
      errors.push(`${key}: merged result invalid: ${v.join("; ")}`);
      continue;
    }
    const same =
      current.title === result.title && current.description === result.description && stable(current.publicData) === stable(result.publicData) && stable(current.metadata) === stable(result.metadata);
    actions.push(same ? { kind: "noop", offerKey: key, listingId: existing.id } : { kind: "update", offerKey: key, listingId: existing.id, patch, result });
  }
  return { actions: errors.length ? [] : actions, errors };
}
