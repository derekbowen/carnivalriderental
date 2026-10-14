import { describe, expect, it } from "vitest";
import { normalizeAll, normalizeListing, type SharetribeListing } from "@/lib/catalog/normalize";
import { planSeed, withBinding, type ExistingListing, type SeedSample } from "@/lib/catalog/seed";
import { eligibleLocations, toRideViewModel } from "@/lib/catalog/view";
import { demoContent } from "@/lib/content/demo/fixtures";

/** Shapes below mirror the Marketplace API listing resource; they are test inputs, not integration evidence. */
const listing = (over: Partial<SharetribeListing["attributes"]> = {}, id = "11111111-1111-1111-1111-111111111111"): SharetribeListing => ({
  id,
  attributes: {
    title: "[TEST] Ferris wheel rental",
    description: "TEST LISTING — not a real offer.",
    state: "published",
    publicData: { listingType: "managed-ride-rental", transactionProcessAlias: "default-negotiation/release-1", unitType: "offer", categoryLevel1: "ferris-wheels" },
    metadata: { offerKey: "ofr-test-ferris-wheel-family", offeringScope: "ride-family", requestableStates: ["tx"], eventTypes: ["festival"], pricingMode: "quote-required" },
    ...over,
  },
});
const withMeta = (m: Record<string, unknown>) => listing({ metadata: { ...listing().attributes.metadata, ...m } });
const store = (prov: unknown = null) => ({ offerings: { "ofr-test-ferris-wheel-family": { slug: "test-ferris-wheel-rental", isTestSample: true, estimateProvenance: prov as null } } });

describe("read-side normalisation", () => {
  it("normalises a valid listing", () => {
    const r = normalizeListing(listing(), store());
    expect(r.ok && r.record.slug).toBe("test-ferris-wheel-rental");
  });

  it("rejects a Console edit that adds an unknown field", () => {
    const r = normalizeListing(withMeta({ poolAmenities: ["slide"] }), store());
    expect(r.ok).toBe(false);
  });
  it("rejects a record without coverage — missing coverage never means nationwide", () => {
    const r = normalizeListing(withMeta({ requestableStates: undefined }), store());
    expect(r.ok).toBe(false);
  });
  it("rejects unpublished and deleted listings", () => {
    expect(normalizeListing(listing({ state: "draft" }), store()).ok).toBe(false);
    expect(normalizeListing(listing({ deleted: true }), store()).ok).toBe(false);
  });
  it("rejects a listing with no catalog record (no slug, no publication decision)", () => {
    expect(normalizeListing(listing(), { offerings: {} }).ok).toBe(false);
  });
  it("rejects geolocation added in Console", () => {
    expect(normalizeListing(listing({ geolocation: { lat: 30, lng: -97 } }), store()).ok).toBe(false);
  });

  it("withholds an estimate without approved provenance, shows it with provenance", () => {
    const est = withMeta({ pricingMode: "indicative-range", estimateLowUsd: 9000, estimateHighUsd: 15000, estimateBasis: "Per event." });
    const without = normalizeListing(est, store());
    expect(without.ok && without.record.pricing.mode).toBe("quote-required");
    expect(without.ok && without.record.withheld.join()).toMatch(/provenance/);
    const withProv = normalizeListing(est, store({ approvedBy: "founder", approvedAt: "2026-10-01", source: "operator rate sheet" }));
    expect(withProv.ok && withProv.record.pricing.mode).toBe("indicative-range");
  });

  it("never carries privateData into the record even if a response contained it", () => {
    const r = normalizeListing(listing({ privateData: { supplierCost: 12000, operatorPhone: "555-0100" } }), store());
    expect(JSON.stringify(r)).not.toMatch(/supplierCost|555-0100/);
  });

  it("keeps unreviewed event types unknown (null), not empty-but-claimed", () => {
    const r = normalizeListing(withMeta({ eventTypes: undefined }), store());
    expect(r.ok && r.record.eventTypes).toBeNull();
    expect(r.ok && toRideViewModel(r.record).suitability).toEqual([]);
  });

  it("rejects every listing sharing a duplicated offerKey", () => {
    const { records, rejected } = normalizeAll([listing({}, "a"), listing({}, "b")], store());
    expect(records).toHaveLength(0);
    expect(rejected.map((r) => r.listingId).sort()).toEqual(["a", "b"]);
  });
});

describe("view model and pSEO eligibility", () => {
  it("shows a city only when its state is covered; specs stay absent", () => {
    const r = normalizeListing(listing(), store());
    if (!r.ok) throw new Error("expected ok");
    const cities = eligibleLocations(r.record, demoContent.locations).map((l) => l.stateCode);
    expect(cities).toEqual(["TX"]);
    expect(toRideViewModel(r.record).specs).toEqual([]);
    expect(toRideViewModel(r.record).estimate).toBeNull();
  });
});

describe("seed planning", () => {
  const sample = (key: string, states = ["tx"]): SeedSample => ({
    title: `[TEST] ${key}`,
    description: "TEST LISTING",
    publicData: { categoryLevel1: "ferris-wheels" },
    metadata: { offerKey: key, offeringScope: "ride-family", requestableStates: states, pricingMode: "quote-required" },
  });
  const asExisting = (id: string, s: SeedSample): ExistingListing => {
    const r = withBinding(s);
    return { id, state: "published", title: r.title, description: r.description, publicData: r.publicData, metadata: r.metadata };
  };

  it("creates when absent, then no-ops on re-run (idempotent)", () => {
    const s = [sample("ofr-test-a")];
    expect(planSeed({ existing: [], map: {}, samples: s }).actions.map((a) => a.kind)).toEqual(["create"]);
    const second = planSeed({ existing: [asExisting("L1", s[0])], map: { "ofr-test-a": "L1" }, samples: s });
    expect(second.actions.map((a) => a.kind)).toEqual(["noop"]);
  });

  it("updates with a validated merged record, deleting keys the sample dropped", () => {
    const before = sample("ofr-test-a");
    before.metadata.eventTypes = ["festival"];
    const after = sample("ofr-test-a", ["tx", "az"]);
    const plan = planSeed({ existing: [asExisting("L1", before)], map: { "ofr-test-a": "L1" }, samples: [after] });
    const a = plan.actions[0];
    expect(a.kind).toBe("update");
    if (a.kind === "update") {
      expect(a.patch.metadata!.eventTypes).toBeNull();
      expect(a.result.metadata.eventTypes).toBeUndefined();
      expect(a.result.metadata.requestableStates).toEqual(["tx", "az"]);
    }
  });

  it("aborts on duplicate offerKeys in Sharetribe", () => {
    const s = sample("ofr-test-a");
    const r = planSeed({ existing: [asExisting("L1", s), asExisting("L2", s)], map: {}, samples: [s] });
    expect(r.actions).toEqual([]);
    expect(r.errors.join()).toMatch(/duplicate offerKey/);
  });

  it("aborts when an offerKey was changed outside the seed path (e.g. Console)", () => {
    const changed = asExisting("L1", sample("ofr-test-renamed"));
    const r = planSeed({ existing: [changed], map: { "ofr-test-a": "L1" }, samples: [sample("ofr-test-a")] });
    expect(r.errors.join()).toMatch(/changed from ofr-test-a/);
  });

  it("aborts when the sample file is invalid or repeats a key", () => {
    const bad = sample("ofr-test-a");
    bad.metadata.requestableStates = [];
    expect(planSeed({ existing: [], map: {}, samples: [bad] }).errors.join()).toMatch(/at least 1/);
    expect(planSeed({ existing: [], map: {}, samples: [sample("ofr-test-a"), sample("ofr-test-a")] }).errors.join()).toMatch(/repeats/);
  });
});
