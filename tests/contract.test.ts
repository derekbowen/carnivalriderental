import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { demoContent } from "@/lib/content/demo/fixtures";
import {
  CATEGORY_IDS,
  CONTRACT,
  diffAgainstSnapshot,
  EVENT_TYPE_IDS,
  FIELDS,
  LISTING_TYPE,
  optionValues,
  validateOfferingWrite,
  type OfferingWrite,
  type SharetribeSnapshot,
} from "@/lib/contract";
import { eventBriefSchema } from "@/lib/requests/schema";

const validFamilyOffering = (): OfferingWrite => ({
  title: "Ferris wheel rental",
  description: "We source a suitable Ferris wheel and operating crew for your event.",
  publicData: {
    listingType: "managed-ride-rental",
    transactionProcessAlias: "default-negotiation/release-1",
    unitType: "offer",
    categoryLevel1: "ferris-wheels",
  },
  metadata: {
    offerKey: "ofr-ferris-wheel-family",
    offeringScope: "ride-family",
    requestableStates: ["tx", "ok"],
    eventTypes: ["festival", "municipal"],
    pricingMode: "quote-required",
  },
});

describe("contract manifest integrity", () => {
  it("has unique, well-formed, permanent identifiers", () => {
    const keys = FIELDS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k).toMatch(/^[a-z][A-Za-z0-9]*$/);
    for (const c of CATEGORY_IDS) expect(c).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(new Set(CATEGORY_IDS).size).toBe(CATEGORY_IDS.length);
    for (const f of FIELDS) {
      const opts = optionValues(f);
      expect(new Set(opts).size).toBe(opts.length);
      for (const o of opts) expect(o).toMatch(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/);
      if (f.type === "enum" || f.type === "multi-enum") expect(opts.length).toBeGreaterThan(0);
      expect(f.meaning.length).toBeGreaterThan(10);
    }
  });

  it("uses exactly one listing type, and it is not a booking/calendar process", () => {
    expect(CONTRACT.listingTypes).toHaveLength(1);
    expect(LISTING_TYPE.transactionProcess.name).not.toMatch(/booking/);
  });

  it("keeps all contract fields operator-written (metadata) and nothing in privateData", () => {
    for (const f of FIELDS) expect(f.scope).toBe("metadata");
  });

  it("covers 50 states + DC", () => {
    expect(CONTRACT.optionSets.usStates.values).toHaveLength(51);
  });
});

describe("one source of truth across the app", () => {
  it("request-form event types are the contract's event types", () => {
    const formOptions = (eventBriefSchema as unknown as { _def: { schema: { shape: { eventType: { options: string[] } } } } })._def.schema.shape.eventType.options;
    expect([...formOptions].sort()).toEqual([...EVENT_TYPE_IDS].sort());
  });

  it("frontend category slugs are contract category IDs", () => {
    for (const c of demoContent.categories) expect(CATEGORY_IDS).toContain(c.slug);
  });
});

describe("validateOfferingWrite", () => {
  it("accepts a valid ride-family offering", () => {
    expect(validateOfferingWrite(validFamilyOffering())).toEqual([]);
  });

  it("accepts a specific-model offering with verified specs and an indicative estimate", () => {
    const w = validFamilyOffering();
    w.metadata = {
      ...w.metadata,
      offerKey: "ofr-example-model",
      offeringScope: "specific-model",
      manufacturer: "Example Manufacturer",
      model: "Example Model 20",
      specHeightFt: 65,
      pricingMode: "indicative-range",
      estimateLowUsd: 9000,
      estimateHighUsd: 15000,
      estimateBasis: "Per event, 1–3 operating days; long-distance transport quoted separately.",
    };
    expect(validateOfferingWrite(w)).toEqual([]);
  });

  const reject = (mutate: (w: OfferingWrite) => void, msg: RegExp) => {
    const w = validFamilyOffering();
    mutate(w);
    const errs = validateOfferingWrite(w);
    expect(errs.join("\n")).toMatch(msg);
  };

  it("rejects missing required fields", () => reject((w) => delete w.metadata.requestableStates, /requestableStates is required/));
  it("rejects unknown metadata keys (no ad-hoc fields)", () => reject((w) => (w.metadata.poolAmenities = ["x"]), /poolAmenities is not in the contract/));
  it("rejects unknown publicData keys", () => reject((w) => (w.publicData.advantagesSelection = "x"), /advantagesSelection is not in the contract/));
  it("rejects specs on a ride-family offering", () => reject((w) => (w.metadata.specHeightFt = 60), /specHeightFt must be omitted when offeringScope = ride-family/));
  it("rejects model on a ride-family offering", () => reject((w) => (w.metadata.model = "X"), /model must be omitted/));
  it("rejects an estimate when pricing is quote-required", () => reject((w) => (w.metadata.estimateLowUsd = 1000), /estimateLowUsd must be omitted/));
  it("requires the full estimate when indicative-range", () => reject((w) => (w.metadata.pricingMode = "indicative-range"), /estimateLowUsd is required when pricingMode = indicative-range/));
  it("rejects high < low", () =>
    reject((w) => Object.assign(w.metadata, { pricingMode: "indicative-range", estimateLowUsd: 5000, estimateHighUsd: 4000, estimateBasis: "x" }), /estimateHighUsd must be >= estimateLowUsd/));
  it("rejects invalid and duplicate state codes", () => reject((w) => (w.metadata.requestableStates = ["tx", "TX", "zz", "tx"]), /invalid values: TX, zz[\s\S]*duplicate/));
  it("rejects an empty coverage list", () => reject((w) => (w.metadata.requestableStates = []), /at least 1/));
  it("rejects non-integer numbers", () => reject((w) => Object.assign(w.metadata, { offeringScope: "specific-model", manufacturer: "M", model: "N", specHeightFt: 65.5 }), /must be an integer/));
  it("rejects bad offerKey format", () => reject((w) => (w.metadata.offerKey = "Ferris Wheel"), /offerKey does not match/));
  it("rejects over-long single-line text", () => reject((w) => Object.assign(w.metadata, { offeringScope: "specific-model", manufacturer: "M".repeat(71), model: "N" }), /exceeds 70/));
  it("rejects an unknown category", () => reject((w) => (w.publicData.categoryLevel1 = "zippers"), /categoryLevel1 must be one of/));
  it("rejects the wrong listing type / process", () => reject((w) => (w.publicData.listingType = "daily-booking"), /listingType must be "managed-ride-rental"/));
  it("rejects geolocation, price, availability and privateData", () => {
    const w = validFamilyOffering();
    Object.assign(w, { geolocation: { lat: 1, lng: 2 }, price: { amount: 100, currency: "USD" }, availabilityPlan: { type: "x" }, privateData: { supplierCost: 1 } });
    const errs = validateOfferingWrite(w).join("\n");
    for (const m of [/geolocation/, /price/, /availabilityPlan/, /privateData/]) expect(errs).toMatch(m);
  });
});

describe("drift detection", () => {
  it("reports the real Test snapshot's differences (defaults, nothing created yet)", () => {
    const file = "contract/snapshots/carnivalrental-test-2026-10-01.json";
    const snap = JSON.parse(fs.readFileSync(file, "utf8")) as SharetribeSnapshot;
    const drift = diffAgainstSnapshot(snap);
    const what = drift.map((d) => `${d.kind}:${d.what}`);
    expect(what).toContain("missing:listing type managed-ride-rental");
    expect(what).toContain("unexpected:listing type daily-booking");
    expect(what).toContain("unexpected:listing field exampleField");
    expect(what.filter((w) => w.startsWith("missing:category"))).toHaveLength(6);
  });

  it("reports zero drift for a configuration that matches the contract", () => {
    const phase1 = FIELDS.filter((f) => f.consoleField && f.createInPhase === "1");
    const snap: SharetribeSnapshot = {
      marketplaceName: "synthetic",
      assets: {
        "listings/listing-types.json": { status: "ok", data: { listingTypes: [{ id: "managed-ride-rental", transactionProcess: { alias: "default-negotiation/release-1" }, unitType: "offer" }] } },
        "listings/listing-categories.json": { status: "ok", data: { categories: CATEGORY_IDS.map((id) => ({ id })) } },
        "listings/listing-fields.json": {
          status: "ok",
          data: { listingFields: phase1.map((f) => ({ key: f.key, scope: f.scope, schemaType: f.type === "shortText" ? "text" : f.type, enumOptions: optionValues(f).map((option) => ({ option })) })) },
        },
      },
    };
    expect(diffAgainstSnapshot(snap)).toEqual([]);
  });

  it("detects a mismatched option set", () => {
    const states = FIELDS.find((f) => f.key === "requestableStates")!;
    const snap: SharetribeSnapshot = {
      marketplaceName: "synthetic",
      assets: { "listings/listing-fields.json": { status: "ok", data: { listingFields: [{ key: "requestableStates", scope: "metadata", schemaType: "multi-enum", enumOptions: optionValues(states).slice(1).map((option) => ({ option })) }] } } },
    };
    expect(diffAgainstSnapshot(snap).some((d) => d.what === "listing field requestableStates options")).toBe(true);
  });
});
