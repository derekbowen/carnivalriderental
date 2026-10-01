import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { demoContent } from "@/lib/content/demo/fixtures";
import {
  CATEGORY_IDS,
  CONTRACT,
  diffAgainstSnapshot,
  EVENT_TYPE_IDS,
  FIELDS,
  LISTING_TYPE_ID,
  PROCESS_BINDING,
  mergeOfferingPatch,
  validateOfferingRecord,
  verifyConfiguration,
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

  it("uses exactly one listing type, bound to a non-calendar process that is marked temporary", () => {
    expect(CONTRACT.listingTypes).toHaveLength(1);
    expect(LISTING_TYPE_ID).toBe("managed-ride-rental");
    expect(PROCESS_BINDING.transactionProcess.name).not.toMatch(/booking/);
    expect(PROCESS_BINDING.status).toBe("temporary-test-scaffold");
    // Identity is never derived from the process alias.
    expect(JSON.stringify(CONTRACT.listingTypes[0])).not.toContain("default-negotiation");
  });

  it("keeps all contract fields operator-written (metadata) and nothing in privateData", () => {
    expect(FIELDS.find((f) => f.key === "eventTypes")!.required).toBe(false); // display-only, may be unreviewed
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

  it("accepts an indicative estimate and an offering with no reviewed event types", () => {
    const w = validFamilyOffering();
    delete w.metadata.eventTypes;
    Object.assign(w.metadata, { pricingMode: "indicative-range", estimateLowUsd: 9000, estimateHighUsd: 15000, estimateBasis: "Per event, 1–3 operating days." });
    expect(validateOfferingWrite(w)).toEqual([]);
  });

  it("rejects specific-model offerings until the deferred spec fields are approved", () => {
    const w = validFamilyOffering();
    w.metadata.offeringScope = "specific-model";
    expect(validateOfferingWrite(w).join()).toMatch(/deferred/);
  });

  it("validates the merged result of an update, not just the patch", () => {
    const existing = validFamilyOffering();
    Object.assign(existing.metadata, { pricingMode: "indicative-range", estimateLowUsd: 9000, estimateHighUsd: 15000, estimateBasis: "x" });
    // Patch alone looks harmless, but removing the basis breaks the merged record.
    const merged = mergeOfferingPatch(existing, { metadata: { estimateBasis: null } });
    expect(validateOfferingRecord(merged).join()).toMatch(/estimateBasis is required/);
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
  it("rejects spec keys that are not approved yet (deferred)", () => reject((w) => (w.metadata.specHeightIn = 786), /specHeightIn is not in the contract/));
  it("rejects an estimate when pricing is quote-required", () => reject((w) => (w.metadata.estimateLowUsd = 1000), /estimateLowUsd must be omitted/));
  it("requires the full estimate when indicative-range", () => reject((w) => (w.metadata.pricingMode = "indicative-range"), /estimateLowUsd is required when pricingMode = indicative-range/));
  it("rejects high < low", () =>
    reject((w) => Object.assign(w.metadata, { pricingMode: "indicative-range", estimateLowUsd: 5000, estimateHighUsd: 4000, estimateBasis: "x" }), /estimateHighUsd must be >= estimateLowUsd/));
  it("rejects invalid and duplicate state codes", () => reject((w) => (w.metadata.requestableStates = ["tx", "TX", "zz", "tx"]), /invalid values: TX, zz[\s\S]*duplicate/));
  it("rejects an empty coverage list", () => reject((w) => (w.metadata.requestableStates = []), /at least 1/));
  it("rejects non-integer dollar amounts", () => reject((w) => Object.assign(w.metadata, { pricingMode: "indicative-range", estimateLowUsd: 9000.5, estimateHighUsd: 15000, estimateBasis: "x" }), /must be an integer/));
  it("rejects bad offerKey format", () => reject((w) => (w.metadata.offerKey = "Ferris Wheel"), /offerKey does not match/));
  it("rejects over-long text", () => reject((w) => Object.assign(w.metadata, { pricingMode: "indicative-range", estimateLowUsd: 1, estimateHighUsd: 2, estimateBasis: "x".repeat(301) }), /exceeds 300/));
  it("rejects an unknown category", () => reject((w) => (w.publicData.categoryLevel1 = "zippers"), /categoryLevel1 must be one of/));
  it("rejects the wrong listing type / process", () => reject((w) => (w.publicData.listingType = "daily-booking"), /listingType must be "managed-ride-rental"/));
  it("rejects geolocation, price, availability and privateData", () => {
    const w = validFamilyOffering();
    Object.assign(w, { geolocation: { lat: 1, lng: 2 }, price: { amount: 100, currency: "USD" }, availabilityPlan: { type: "x" }, privateData: { supplierCost: 1 } });
    const errs = validateOfferingWrite(w).join("\n");
    for (const m of [/geolocation/, /price/, /availabilityPlan/, /privateData/]) expect(errs).toMatch(m);
  });
});

describe("configuration verification", () => {
  const conforming = (): SharetribeSnapshot => {
    const phase1 = FIELDS.filter((f) => f.consoleExpect?.console);
    return {
      marketplaceName: "synthetic",
      assets: {
        "listings/listing-types.json": { status: "ok", data: { listingTypes: [{ id: "managed-ride-rental", transactionProcess: { alias: "default-negotiation/release-1" }, unitType: "offer" }] } },
        "listings/listing-categories.json": { status: "ok", data: { categories: CATEGORY_IDS.map((id) => ({ id })) } },
        "listings/listing-fields.json": {
          status: "ok",
          data: {
            listingFields: phase1.map((f) => ({
              key: f.key,
              scope: f.consoleExpect!.scope,
              schemaType: f.consoleExpect!.schemaType,
              filterConfig: { indexForSearch: f.consoleExpect!.indexForSearch },
              enumOptions: optionValues(f).map((option) => ({ option })),
            })),
          },
        },
        "listings/listing-search.json": { status: "ok", data: { mainSearch: { searchType: "keywords" }, keywordsFilter: { enabled: true }, priceFilter: { enabled: false }, dateRangeFilter: { enabled: false }, categoryFilter: { enabled: true } } },
        "transactions/commission.json": { status: "ok", data: { providerCommission: { percentage: 0 }, customerCommission: { percentage: 0 } } },
      },
    };
  };

  it("the real Test snapshot is NOT verified (untouched defaults)", () => {
    const snap = JSON.parse(fs.readFileSync("contract/snapshots/carnivalrental-test-2026-10-01.json", "utf8")) as SharetribeSnapshot;
    const r = verifyConfiguration(snap);
    expect(r.fullyVerified).toBe(false);
    const byId = Object.fromEntries(r.checks.map((c) => [c.id, c.status]));
    expect(byId["listingType:managed-ride-rental"]).toBe("drift");
    expect(byId["listingType:daily-booking"]).toBe("drift");
    expect(byId["field:exampleField"]).toBe("drift");
    expect(byId["listing-search.json:priceFilter.enabled"]).toBe("drift");
    expect(byId["listing-search.json:mainSearch.searchType"]).toBe("drift"); // "location" is a known, wrong value
    expect(byId["commission.json:providerCommission.percentage"]).toBe("drift");
    expect(byId["commission.json:customerCommission.percentage"]).toBe("unverified");
  });

  it("an exactly conforming configuration verifies; equal values count as matches even where the encoding was unconfirmed", () => {
    const r = verifyConfiguration(conforming());
    expect(r.counts.drift).toBe(0);
    // metadata scope spelling, text schema encoding, keyword searchType, customerCommission path, categories format
    expect(r.counts.unverified).toBe(0); // all equal -> match even if unconfirmed
    expect(r.fullyVerified).toBe(true);
    expect(r.outOfCoverage.length).toBeGreaterThan(0);
  });

  const negative = (label: string, mutate: (s: SharetribeSnapshot) => void, id: string, status: "drift" | "unverified") =>
    it(`negative: ${label}`, () => {
      const snap = conforming();
      mutate(snap);
      const r = verifyConfiguration(snap);
      expect(r.fullyVerified).toBe(false);
      expect(r.checks.find((c) => c.id === id)?.status).toBe(status);
    });

  const fieldOf = (s: SharetribeSnapshot, key: string) => (s.assets["listings/listing-fields.json"].data!.listingFields as Record<string, unknown>[]).find((f) => f.key === key)!;
  const search = (s: SharetribeSnapshot) => s.assets["listings/listing-search.json"].data as Record<string, Record<string, unknown>>;

  negative("price filter enabled", (s) => (search(s).priceFilter.enabled = true), "listing-search.json:priceFilter.enabled", "drift");
  negative("date-availability filter enabled", (s) => (search(s).dateRangeFilter.enabled = true), "listing-search.json:dateRangeFilter.enabled", "drift");
  negative("category filter disabled", (s) => (search(s).categoryFilter.enabled = false), "listing-search.json:categoryFilter.enabled", "drift");
  negative("location-first main search", (s) => (search(s).mainSearch.searchType = "location"), "listing-search.json:mainSearch.searchType", "drift");
  negative("unknown main-search spelling", (s) => (search(s).mainSearch.searchType = "keyword"), "listing-search.json:mainSearch.searchType", "unverified");
  negative("coverage field not indexed", (s) => (fieldOf(s, "requestableStates").filterConfig = { indexForSearch: false }), "field:requestableStates.indexForSearch", "drift");
  negative("coverage field filterConfig missing", (s) => delete fieldOf(s, "requestableStates").filterConfig, "field:requestableStates.indexForSearch", "drift");
  negative("coverage field wrong scope (unconfirmed spelling)", (s) => (fieldOf(s, "requestableStates").scope = "public"), "field:requestableStates.scope", "unverified");
  negative("coverage field wrong schema", (s) => (fieldOf(s, "requestableStates").schemaType = "enum"), "field:requestableStates.schemaType", "drift");
  negative("text field with an unconfirmed encoding is not proof", (s) => (fieldOf(s, "estimateBasis").schemaType = "shortText"), "field:estimateBasis.schemaType", "unverified");
  negative("one state option missing", (s) => (fieldOf(s, "requestableStates").enumOptions = (fieldOf(s, "requestableStates").enumOptions as unknown[]).slice(1)), "field:requestableStates.options", "drift");
  negative("provider commission not 0", (s) => ((s.assets["transactions/commission.json"].data as Record<string, Record<string, number>>).providerCommission.percentage = 10), "commission.json:providerCommission.percentage", "drift");
  negative("customer commission absent", (s) => delete (s.assets["transactions/commission.json"].data as Record<string, unknown>).customerCommission, "commission.json:customerCommission.percentage", "unverified");
  negative("search asset unreadable", (s) => (s.assets["listings/listing-search.json"] = { status: "error-500" }), "listing-search.json:priceFilter.enabled", "unverified");
  negative("categories asset in an unknown format", (s) => (s.assets["listings/listing-categories.json"].data = { tree: [] }), "category:ferris-wheels", "unverified");
  negative("default booking type not retired", (s) => (s.assets["listings/listing-types.json"].data!.listingTypes as unknown[]).push({ id: "daily-booking", transactionProcess: { alias: "default-booking/release-1" } }), "listingType:daily-booking", "drift");
  negative("process binding changed", (s) => ((s.assets["listings/listing-types.json"].data!.listingTypes as Record<string, Record<string, string>>[])[0].transactionProcess.alias = "default-booking/release-1"), "listingType:managed-ride-rental.processAlias", "drift");
});
