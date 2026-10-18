/**
 * National gap audit → import workbook (founder go 2026-10-18). The merged rows must pass the unchanged
 * importers' planning (planImport, planListings) and their anonymous Live payloads must not identify
 * the operator. Only verified current equipment of a company we can sell is taken.
 */
import { describe, expect, it } from "vitest";
import { buildAnonymousPayload, IMPORT_BATCH, planImport } from "@/lib/imports/company-accounts";
import { cleanSummary, companyWords, describeRide, feet, inches, mergeWorkbook, parseCsv, planGapAudit, type AuditFiles, type CsvRow, type GapWorkbook } from "@/lib/imports/gap-audit";
import { buildAnonymousListingPayload, planListings } from "@/lib/imports/operator-listings";

const geocode = (city: string, state: string) => (state === "OK" || state === "OH" ? { lat: 36.15, lng: -95.99 } : null);

function existingUser(companyId: string, externalId: string, tier: string, extra: { hq?: boolean } = { hq: true }) {
  return {
    externalId,
    importTier: tier,
    emailPlaceholder: `${companyId}@<CLAIM_DOMAIN>`,
    firstName: "Buckeye",
    lastName: "Shows",
    displayName: "Buckeye Shows",
    bio: null,
    publicData: JSON.stringify({ companyName: "Buckeye Shows", ...(extra.hq ? { hqCity: "Columbus", hqState: "OH" } : {}) }),
    protectedData: JSON.stringify({ phoneNumber: "614-555-0100" }),
    privateData: JSON.stringify(extra.hq ? { hqLat: 39.96, hqLng: -83.0, contactName: "Pat Example" } : { contactName: "Pat Example" }),
    metadata: JSON.stringify({ claimStatus: "unclaimed", importBatch: IMPORT_BATCH, companyId, importSource: "cw_directory", researchStatus: "active" }),
  };
}

const base = (): GapWorkbook => ({
  source: { file: "fixture.xlsx", sha256: "0".repeat(64) },
  users: [existingUser("buckeye-shows", "cw-1", "A_ready"), existingUser("verify-me-rides", "cw-2", "C_verify_first", { hq: false }), existingUser("quiet-shows", "cw-3", "C_verify_first")],
  companies: [{ companyId: "buckeye-shows", importTier: "A_ready" }, { companyId: "verify-me-rides", importTier: "C_verify_first" }, { companyId: "quiet-shows", importTier: "C_verify_first" }],
  listings: [],
});

const ride = (o: Partial<CsvRow>): CsvRow => ({ import_status: "READY", gap_class: "EXISTING_OPERATOR_NEW_RIDES", company_name: "", existing_company_id: "buckeye-shows", ride_name: "Tilt-A-Whirl", normalized_ride_type: "scrambler/tilt/spinning flat", manufacturer: "Sellner", model: "", ride_class: "major", description: "Classic spinning flat ride; site says it is inspected by the state.", minimum_height: '42" minimum', capacity: "21 riders", footprint_length: "50 ft", footprint_width: "45 ft", ride_height: "", service_states: "OH | IN", photo_urls: "https://example.org/tilt.jpg", photo_source_pages: "", image_rights: "not cleared", source_page: "https://example.org/rides/tilt", source_type: "operator_site", source_date: "", ownership_status: "current", confidence: "high", notes: "", entity_id: "", found_by_agents: "", ...o });

const audit = (): AuditFiles => ({
  companiesNew: [{ import_status: "READY", gap_class: "NEW_OPERATOR", company_name: "Sooner Kiddie Rentals", legal_name_if_known: "", dba_names: "", website: "soonerkiddie.example.org", domain: "", phone: "918-555-0199", email: "hello@soonerkiddie.example.org", contact_name: "Jordan Sample", hq_city: "Tulsa", hq_state: "OK", hq_zip: "74103", states_served: "OK | AR", active_status: "active", status_evidence: "2026 fair pages", sources: "https://fair.example.org/2026", entity_id: "new:sooner" },
    { import_status: "REVIEW", gap_class: "NEW_OPERATOR", company_name: "Maybe Rides", hq_city: "Tulsa", hq_state: "OK", entity_id: "new:maybe" }],
  ridesNew: [
    ride({}),
    ride({ ride_name: "Bounce House", import_status: "REJECT" }),
    ride({ ride_name: "Old Wheel", import_status: "HOLD" }),
    ride({ ride_name: "Registry Swing", import_status: "REVIEW", source_type: "state_registry" }),
    ride({ ride_name: "Unnamed kiddie ride 3", import_status: "REVIEW", notes: "needs a human to name the ride from the photo" }),
    ride({ ride_name: "Tilt-A-Whirl", description: "duplicate in the audit" }),
    ride({ gap_class: "NEW_OPERATOR", existing_company_id: "", entity_id: "new:sooner", ride_name: "Dragon Coaster", ride_class: "kiddie", description: "Kiddie coaster on Sooner Kiddie Rentals' midway; $150 per day; available all summer. A small dragon train loops a figure eight.", minimum_height: "36 in", footprint_length: "", footprint_width: "", capacity: "" }),
    ride({ gap_class: "NEW_OPERATOR", existing_company_id: "", entity_id: "new:maybe", ride_name: "Maybe Swing" }),
    ride({ existing_company_id: "verify-me-rides", ride_name: "Carousel" }),
    ride({ existing_company_id: "quiet-shows", ride_name: "Scrambler", import_status: "REVIEW" }),
    ride({ existing_company_id: "gone-shows", ride_name: "Paratrooper" }),
  ],
  companiesUpdates: [{ import_status: "READY", company_id: "verify-me-rides", field: "hq_city", new_value: "Tulsa" }, { import_status: "READY", company_id: "verify-me-rides", field: "hq_state", new_value: "OK" }],
  inactive: [],
});

describe("gap audit helpers", () => {
  it("parses quoted CSV with commas, doubled quotes and newlines", () => {
    expect(parseCsv('﻿a,b\n"x, y","say ""hi""\nthere"\n')).toEqual([{ a: "x, y", b: 'say "hi"\nthere' }]);
  });
  it("reads sizes and heights, and refuses nonsense", () => {
    expect(feet("60 ft")).toBe(60);
    expect(inches('42" minimum')).toBe(42);
    expect(inches("4 ft")).toBe(48);
    expect(inches("300")).toBeNull();
    expect(feet("")).toBeNull();
  });
  it("drops claims we never make, research notes and the operator's name; keeps the ride text", () => {
    const avoid = companyWords(["Sooner Kiddie Rentals"]);
    expect(avoid).toEqual(["sooner", "kiddie"]);
    expect(cleanSummary("Spinning teacups; site says it is inspected by the PA Dept. of Agriculture. $200 a day. Insured.")).toBe("Spinning teacups.");
    expect(cleanSummary("Details on operator page. Category inferred from name.")).toBe("");
    expect(cleanSummary("A ride on Sooner's midway. Riders spin.", ["sooner"])).toBe("Riders spin.");
  });
  it("describes a ride from the cleaned summary plus the recorded facts", () => {
    const d = describeRide(ride({}), "major");
    expect(d).toBe("Classic spinning flat ride.\n\nRider rules: minimum height 42 in.\n\nCapacity: 21 riders.\n\nSize: 50 ft × 45 ft footprint. Confirm the space needed with the operator.");
    expect(describeRide(ride({ description: "", minimum_height: "", capacity: "", footprint_length: "", footprint_width: "" }), "kiddie")).toBe("Kiddie ride listed by an independent operator.");
  });
});

describe("planGapAudit + mergeWorkbook", () => {
  const wb = base();
  const plan = planGapAudit(audit(), wb, geocode);
  const merged = mergeWorkbook(wb, plan, audit().companiesUpdates);

  it("takes only verified current equipment of companies we can stand behind", () => {
    const titles = plan.listings.map((l) => l.title).sort();
    expect(titles).toEqual(["Carousel", "Dragon Coaster", "Tilt-A-Whirl"]);
    expect(plan.users.map((u) => u.externalId)).toEqual(["gap-sooner-kiddie-rentals"]);
    expect(plan.promoted).toEqual(["verify-me-rides"]);
    expect(plan.skipped).toMatchObject({
      "ride REJECT: not verified current equipment": 1,
      "ride HOLD: not verified current equipment": 1,
      "ride REVIEW: not verified current equipment": 2,
      "same ride name already listed for this company": 1,
      "ride at a new company that is not READY": 1,
      "ride at a verify-first company with no READY evidence": 1,
      "ride at an existing company with no account row": 1,
    });
  });

  it("the merged workbook passes the importers' planning with no issues", () => {
    const accounts = planImport(merged as never);
    expect(accounts.issues).toEqual([]);
    expect(accounts.eligible.map((r) => r.externalId).sort()).toEqual(["cw-1", "cw-2", "gap-sooner-kiddie-rentals"]);
    const listings = planListings(merged as never);
    expect(listings.issues).toEqual([]);
    expect(listings.held).toEqual([]);
    expect(listings.rows).toHaveLength(3);
    // The promoted company got its HQ from the audit's READY update.
    const promoted = accounts.eligible.find((r) => r.externalId === "cw-2")!;
    expect(promoted.publicData).toMatchObject({ hqCity: "Tulsa", hqState: "OK" });
    expect(promoted.privateData.hqLat).toBe(36.15);
  });

  it("anonymous Live payloads never identify the operator; contacts stay private", () => {
    const accounts = planImport(merged as never);
    const row = accounts.eligible.find((r) => r.externalId === "gap-sooner-kiddie-rentals")!;
    const acc = buildAnonymousPayload(row, "claims.example.net");
    const pub = JSON.stringify([acc.create.displayName, acc.create.bio, acc.create.publicData, acc.metadata]).toLowerCase();
    for (const s of ["sooner", "918-555", "hello@", "jordan", "soonerkiddie"]) expect(pub).not.toContain(s);
    expect(JSON.stringify(acc.create.privateData)).toContain("918-555-0199");
    const listings = planListings(merged as never);
    const dragon = listings.rows.find((r) => r.title === "Dragon Coaster")!;
    const p = buildAnonymousListingPayload(dragon, listings.authors.get(dragon.authorExternalId)!);
    const text = [p.title, p.description, JSON.stringify(p.publicData), JSON.stringify(p.metadata)].join("\n").toLowerCase();
    for (const s of ["sooner", "$150", "available all summer", "inspected"]) expect(text).not.toContain(s);
    expect(p.description).toContain("A small dragon train loops a figure eight.");
    expect(p.description).toContain("Rider rules: minimum height 36 in.");
    expect(p.privateData).toMatchObject({ sourceImageUrl: "https://example.org/tilt.jpg", sourceRidePage: "https://example.org/rides/tilt" });
    expect(p.publicData).toMatchObject({ rideClass: "kiddie", homeState: "ok", serviceStates: ["oh", "in"] });
  });

  it("is deterministic: planning the original workbook again gives the same rows", () => {
    expect(planGapAudit(audit(), base(), geocode).listings).toEqual(plan.listings);
  });
});
