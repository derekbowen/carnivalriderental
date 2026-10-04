import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { IMPORT_BATCH } from "@/lib/imports/company-accounts";
import {
  type ListingApi,
  type ListingLedgerEntry,
  type ListingMapping,
  type ListingPayload,
  type RemoteListing,
  buildListingPayload,
  cleanDescription,
  planListings,
  runListingImport,
} from "@/lib/imports/operator-listings";

const company = (over: Record<string, unknown> = {}) => ({
  externalId: "cw-1",
  importTier: "A_ready",
  emailPlaceholder: "acme-shows@<CLAIM_DOMAIN>",
  firstName: "Acme",
  lastName: "Shows",
  displayName: "Acme Shows",
  bio: "Acme Shows is a traveling carnival.",
  publicData: JSON.stringify({ companyName: "Acme Shows", hqCity: "Fairbury", hqState: "IL" }),
  protectedData: JSON.stringify({ phoneNumber: "815-555-0101" }),
  privateData: JSON.stringify({ contactName: "Jane Roe", hqStreet: "12 Fair Rd", owners: [{ name: "Jane Roe" }] }),
  metadata: JSON.stringify({ claimStatus: "unclaimed", importBatch: IMPORT_BATCH, companyId: "acme-shows", importSource: "cw_directory", researchStatus: "active" }),
  ...over,
});

const pub = (over: Record<string, unknown> = {}) => ({
  rideCategory: "family",
  footprintSource: "unknown",
  homeState: "IL",
  serviceStates: ["IL", "WI"],
  location: { address: "Fairbury, IL", building: "" },
  ...over,
});

const listing = (id: string, over: Record<string, unknown> = {}, p: Record<string, unknown> = {}, v: Record<string, unknown> = {}) => ({
  externalId: `acme-shows--${id}`,
  authorExternalId: "cw-1",
  title: "Berry Go Round",
  description: "A family ride.\n\nSpace needed: ask the owner for this ride's footprint.",
  lat: 40.72781,
  lng: -88.52142,
  imageUrl: "https://acme.example/berry.jpg",
  publicData: JSON.stringify(pub(p)),
  privateData: JSON.stringify({ sourceRidePage: "https://acme.example/rides/1", sourceImageUrl: "https://acme.example/berry.jpg", ...v }),
  metadata: JSON.stringify({ claimStatus: "unclaimed", importBatch: IMPORT_BATCH, companyId: "acme-shows" }),
  ...over,
});

const wb = (listings: unknown[]) => ({
  source: { file: "t.xlsx", sha256: "0".repeat(64) },
  users: [company()],
  companies: [{ companyId: "acme-shows", importTier: "A_ready" }],
  listings,
});

describe("listing payload (approved mapping)", () => {
  it("pendingApproval, operator type, lowercase states, rounded location, no photo, research text removed", () => {
    const p = planListings(wb([listing("berry")]));
    expect(p.issues).toEqual([]);
    const pay = buildListingPayload(p.rows[0]);
    expect(pay.state).toBe("pendingApproval");
    expect(pay.publicData).toMatchObject({ listingType: "operator-ride-rental", rideClass: "family", homeState: "il", serviceStates: ["il", "wi"], location: { address: "Fairbury, IL" } });
    expect(pay.geolocation).toEqual({ lat: 40.7, lng: -88.5 });
    expect(pay.description).toBe("A family ride.");
    expect(pay).not.toHaveProperty("images");
    expect(pay.publicData).not.toHaveProperty("transactionProcessAlias");
    expect(pay.privateData).toMatchObject({ sourceImageUrl: "https://acme.example/berry.jpg" });
    expect(pay.metadata).toMatchObject({ importExternalId: "acme-shows--berry", claimStatus: "unclaimed", footprintSource: "unknown" });
  });

  it("dimensions public only from the operator's own site; typical values stay private", () => {
    const own = buildListingPayload(planListings(wb([listing("a", {}, { footprintSource: "operator_website", footprintLengthFt: 45, footprintWidthFt: 30, rideHeightFt: 40 })])).rows[0]);
    expect(own.publicData).toMatchObject({ footprintLengthFt: 45, footprintWidthFt: 30, rideHeightFt: 40 });
    const typical = buildListingPayload(planListings(wb([listing("b", {}, { footprintSource: "manufacturer_spec_typical", footprintLengthFt: 60, footprintWidthFt: 50, rideHeightFt: 70 })])).rows[0]);
    expect(typical.publicData).not.toHaveProperty("footprintLengthFt");
    expect(typical.publicData).not.toHaveProperty("rideHeightFt");
    expect(typical.privateData.footprintTypical).toMatchObject({ lengthFt: 60, source: "manufacturer_spec_typical" });
    const range = buildListingPayload(planListings(wb([listing("c", {}, { footprintSource: "type_range", footprintRange: "29-87 ft x 47-62 ft" })])).rows[0]);
    expect(JSON.stringify(range.publicData)).not.toContain("29-87");
  });

  it("manufacturer and model public only at high confidence", () => {
    const hi = buildListingPayload(planListings(wb([listing("a", {}, { manufacturer: "Sellner", rideModel: "Tilt" }, { mfrConfidence: "high" })])).rows[0]);
    expect(hi.publicData).toMatchObject({ manufacturer: "Sellner", rideModel: "Tilt" });
    const lo = buildListingPayload(planListings(wb([listing("b", {}, { manufacturer: "Sellner", rideModel: "Tilt" }, { mfrConfidence: "medium" })])).rows[0]);
    expect(lo.publicData).not.toHaveProperty("manufacturer");
    expect(lo.privateData).toMatchObject({ manufacturerUnverified: "Sellner", rideModelUnverified: "Tilt" });
  });

  it("strips research sentences with links and phone numbers", () => {
    expect(cleanDescription('Rider rules: 32". Listed on the height list (PDF, 2018): http://x.example/a.pdf')).toBe('Rider rules: 32".');
    expect(cleanDescription("Call 815-555-0101 for info.")).not.toMatch(/\d{3}-\d{4}/);
  });

  it("holds rows that would publish contacts, footers or research notes", () => {
    const p = planListings(
      wb([
        listing("ok"),
        listing("named", { description: "A favorite of Jane Roe since 1990." }),
        listing("footer", { description: "Great ride. © 2026 Acme Shows - All Rights Reserved" }),
        listing("note", { description: "Named by owner in the County Gazette." }),
        listing("street", { description: "Visit us at 12 Fair Rd." }),
      ]),
    );
    expect(p.rows.map((r) => r.externalId)).toEqual(["acme-shows--ok"]);
    expect(p.held.map((h) => h.externalId).sort()).toEqual(["acme-shows--footer", "acme-shows--named", "acme-shows--note", "acme-shows--street"]);
  });

  it("rejects listings whose author is not an eligible company", () => {
    const p = planListings(wb([listing("x", { authorExternalId: "cw-999" })]));
    expect(p.rows).toEqual([]);
    expect(p.issues[0].issue).toMatch(/not an eligible imported company/);
  });
});

class FakeListings implements ListingApi {
  listings: (RemoteListing & { authorId: string; payload: ListingPayload })[] = [];
  authors: Record<string, Record<string, unknown> | null> = { "u-1": { claimStatus: "unclaimed" } };
  calls: string[] = [];
  async listByAuthor(authorId: string) {
    this.calls.push(`list ${authorId}`);
    return this.listings.filter((l) => l.authorId === authorId);
  }
  async create(p: ListingPayload & { authorId: string }) {
    this.calls.push(`create ${p.metadata.importExternalId}`);
    const id = `l-${this.listings.length + 1}`;
    this.listings.push({ id, state: p.state, metadata: p.metadata, authorId: p.authorId, payload: p });
    return id;
  }
  async authorMetadata(id: string) {
    return this.authors[id] ?? null;
  }
}

const deps = (api: FakeListings, mapping: ListingMapping = {}, accounts: Record<string, { userId: string }> = { "cw-1": { userId: "u-1" } }) => {
  const ledger: ListingLedgerEntry[] = [];
  return { ledger, mapping, d: { api, mapping, accounts, saveMapping: () => {}, now: () => "2026-10-04T00:00:00Z", runId: "t", onResult: (e: ListingLedgerEntry) => void ledger.push(e) } };
};

describe("listing import run", () => {
  const rows = () => planListings(wb([listing("a"), listing("b")])).rows;

  it("creates once; reruns (with or without the mapping) create nothing", async () => {
    const api = new FakeListings();
    const first = deps(api);
    await runListingImport(rows(), first.d);
    expect(first.ledger.map((e) => e.outcome)).toEqual(["created", "created"]);
    expect(api.listings.every((l) => l.state === "pendingApproval" && l.authorId === "u-1")).toBe(true);

    api.calls = [];
    const again = deps(api, first.mapping);
    await runListingImport(rows(), again.d);
    expect(again.ledger.map((e) => e.outcome)).toEqual(["exists", "exists"]);

    const lost = deps(api, {});
    await runListingImport(rows(), lost.d);
    expect(lost.ledger.map((e) => e.outcome)).toEqual(["exists", "exists"]);
    expect(Object.keys(lost.mapping).sort()).toEqual(["acme-shows--a", "acme-shows--b"]);
    expect(api.calls.some((c) => c.startsWith("create"))).toBe(false);
    expect(api.listings).toHaveLength(2);
  });

  it("waits for missing company accounts and never touches a claimed company", async () => {
    const api = new FakeListings();
    const none = deps(api, {}, {});
    await runListingImport(rows(), none.d);
    expect(none.ledger.map((e) => e.outcome)).toEqual(["waiting_for_author", "waiting_for_author"]);

    api.authors["u-1"] = { claimStatus: "claimed" };
    const claimed = deps(api);
    await runListingImport(rows(), claimed.d);
    expect(claimed.ledger.map((e) => e.outcome)).toEqual(["skipped_claimed", "skipped_claimed"]);
    expect(api.listings).toHaveLength(0);
  });

  it("does not recreate a mapped listing that disappeared", async () => {
    const api = new FakeListings();
    const d = deps(api, { "acme-shows--a": { listingId: "gone", authorId: "u-1", companyId: "acme-shows", createdAt: "" } });
    await runListingImport(rows().slice(0, 1), d.d);
    expect(d.ledger[0].outcome).toBe("failed");
    expect(api.listings).toHaveLength(0);
  });
});

const EXTRACT = "imports/company-accounts/source/workbook.json";
const hasListings = fs.existsSync(EXTRACT) && Array.isArray(JSON.parse(fs.readFileSync(EXTRACT, "utf8")).listings);
describe.skipIf(!hasListings)("Carnival_Host_Import.xlsx listings extract", () => {
  it("3,714 importable, 7 held, no issues, nothing private or unverified in public data", () => {
    const p = planListings(JSON.parse(fs.readFileSync(EXTRACT, "utf8")));
    expect(p.issues).toEqual([]);
    expect(p.rows).toHaveLength(3714);
    expect(p.held).toHaveLength(7);
    for (const r of p.rows) {
      const pay = buildListingPayload(r);
      if (r.publicData.footprintSource !== "operator_website") expect(pay.publicData).not.toHaveProperty("footprintLengthFt");
      expect(JSON.stringify([pay.title, pay.description, pay.publicData])).not.toMatch(/https?:\/\//);
      expect(Buffer.byteLength(JSON.stringify(pay.privateData))).toBeLessThan(50_000);
    }
  });
});
