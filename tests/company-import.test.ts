import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type AccountApi,
  type CompanyRow,
  type CreatePayload,
  type LedgerEntry,
  type Mapping,
  type RemoteUser,
  IMPORT_BATCH,
  buildPayload,
  planImport,
  redact,
  runImport,
  stripPhones,
  validateClaimDomain,
} from "@/lib/imports/company-accounts";

const DOMAIN = "claims.carnival-owned.com";

function userRow(id: string, companyId: string, tier: string, over: Partial<Record<string, unknown>> = {}) {
  return {
    externalId: id,
    importTier: tier,
    emailPlaceholder: `${companyId}@<CLAIM_DOMAIN>`,
    firstName: "Acme",
    lastName: "Shows",
    displayName: "Acme Shows",
    bio: "Acme Shows is a traveling carnival based in Fairbury, IL.",
    publicData: JSON.stringify({ companyName: "Acme Shows", hqCity: "Fairbury", hqState: "IL", statesServed: ["IL"], website: "https://acme.example/", otherOperations: ["Games"] }),
    protectedData: JSON.stringify({ phoneNumber: "815-555-0101" }),
    privateData: JSON.stringify({
      contactName: "Jane Roe",
      contactEmail: "jane@acme.example",
      hqStreet: "12 Fair Rd",
      hqZip: "61739",
      owners: [{ name: "Jane Roe", title: "Owner", source: "https://linkedin.example/jane" }],
      sources: ["https://acme.example/"],
      researchNotes: "Phone on site differs from directory.",
      notableEvents: ["County Fair"],
    }),
    metadata: JSON.stringify({ claimStatus: "unclaimed", importBatch: IMPORT_BATCH, companyId, importSource: "cw_directory", researchStatus: "active" }),
    ...over,
  };
}

function workbook(users: unknown[], companies: { companyId: string; importTier: string }[]) {
  return { source: { file: "t.xlsx", sha256: "0".repeat(64) }, users, companies };
}

const twoRows = () => {
  const plan = planImport(
    workbook(
      [userRow("cw-1", "acme-shows", "A_ready"), userRow("cw-2", "beta-rides", "B_account_only"), userRow("cw-3", "held-co", "C_verify_first")],
      [
        { companyId: "acme-shows", importTier: "A_ready" },
        { companyId: "beta-rides", importTier: "B_account_only" },
        { companyId: "held-co", importTier: "C_verify_first" },
        { companyId: "gone-co", importTier: "D_exclude" },
      ],
    ),
  );
  expect(plan.issues).toEqual([]);
  return plan;
};

/** In-memory Sharetribe: records every call so tests can assert what was (not) done. */
class FakeApi implements AccountApi {
  users = new Map<string, RemoteUser>();
  calls: string[] = [];
  passwords: string[] = [];
  failMetadataOnce = false;
  async showById(id: string) {
    this.calls.push(`showById ${id}`);
    return this.users.get(id) ?? null;
  }
  async showByEmail(email: string) {
    this.calls.push(`showByEmail ${email}`);
    return [...this.users.values()].find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
  }
  async create(p: CreatePayload & { password: string }) {
    this.calls.push(`create ${p.email}`);
    this.passwords.push(p.password);
    if ([...this.users.values()].some((u) => u.email === p.email)) throw new Error("409 email-taken");
    const id = `u-${this.users.size + 1}`;
    this.users.set(id, { id, email: p.email, emailVerified: false, stripeConnected: false, metadata: {}, privateData: p.privateData });
    return id;
  }
  async setMetadata(id: string, metadata: Record<string, unknown>) {
    this.calls.push(`setMetadata ${id}`);
    if (this.failMetadataOnce) {
      this.failMetadataOnce = false;
      throw new Error("HTTP 429 after retries");
    }
    const u = this.users.get(id)!;
    u.metadata = { ...u.metadata, ...metadata };
  }
}

function deps(api: FakeApi, mapping: Mapping = {}) {
  let n = 0;
  const ledger: LedgerEntry[] = [];
  return {
    ledger,
    mapping,
    d: {
      api,
      mapping,
      saveMapping: () => {},
      newPassword: () => `pw-${++n}-Zx9!secret`,
      now: () => "2026-10-04T00:00:00.000Z",
      runId: "test",
      concurrency: 2,
      onResult: (e: LedgerEntry) => void ledger.push(e),
    },
  };
}

describe("plan", () => {
  it("selects A + B, holds C, counts D from the Companies sheet only", () => {
    const p = twoRows();
    expect(p.eligible.map((r) => r.externalId)).toEqual(["cw-1", "cw-2"]);
    expect(p.held.map((r) => r.externalId)).toEqual(["cw-3"]);
    expect(p.excludedCompanies).toEqual(["gone-co"]);
  });

  it("flags tier mismatches, duplicates, bad JSON and D rows in the users sheet", () => {
    const p = planImport(
      workbook(
        [
          userRow("cw-1", "acme-shows", "A_ready"),
          userRow("cw-1", "acme-shows", "A_ready"),
          userRow("cw-4", "x-co", "D_exclude"),
          userRow("cw-5", "y-co", "A_ready", { publicData: "{not json" }),
        ],
        [
          { companyId: "acme-shows", importTier: "B_account_only" },
          { companyId: "x-co", importTier: "D_exclude" },
          { companyId: "y-co", importTier: "A_ready" },
        ],
      ),
    );
    const text = p.issues.map((i) => i.issue).join("\n");
    expect(text).toMatch(/duplicate externalId/);
    expect(text).toMatch(/differs from Companies sheet/);
    expect(text).toMatch(/D_exclude row present/);
    expect(text).toMatch(/publicData is not a JSON object/);
  });

  it("rejects private contacts on public surfaces and sanitises phones and named people out of public text", () => {
    const leaked = planImport(
      workbook([userRow("cw-1", "acme-shows", "A_ready", { bio: "Call Jane at jane@acme.example or visit 12 Fair Rd." })], [{ companyId: "acme-shows", importTier: "A_ready" }]),
    );
    expect(leaked.issues.map((i) => i.issue)).toEqual(expect.arrayContaining(["bio contains an email address", "bio contains private hqStreet"]));

    const pub = JSON.stringify({ companyName: "Acme Shows", otherOperations: ["Rentals (Ride phone (808) 440-4122)", "Games run by Jane Roe", "Film rentals (contact Rob Smith)", "Two units: Blue (813-422-0074) and Orange"] });
    const p = planImport(workbook([userRow("cw-1", "acme-shows", "A_ready", { publicData: pub })], [{ companyId: "acme-shows", importTier: "A_ready" }]));
    expect(p.issues).toEqual([]);
    const row = p.eligible[0];
    expect(row.publicData.otherOperations).toEqual(["Rentals (Ride phone)", "Two units: Blue and Orange"]);
    expect(row.privateData.otherOperationsNamingPeople).toEqual(["Games run by Jane Roe", "Film rentals (contact Rob Smith)"]);
    expect(p.sanitized).toHaveLength(2);
  });

  it("does not treat a founder's name that is the company name as a leak", () => {
    const p = planImport(
      workbook(
        [userRow("cw-1", "arnold-amusements", "A_ready", { displayName: "Arnold Amusements", privateData: JSON.stringify({ contactName: "Arnold", owners: [{ name: "Ivan Arnold" }] }), publicData: JSON.stringify({ companyName: "Arnold Amusements" }) })],
        [{ companyId: "arnold-amusements", importTier: "A_ready" }],
      ),
    );
    expect(p.issues).toEqual([]);
  });

  it("stripPhones leaves non-phone numbers alone", () => {
    expect(stripPhones("Operates the 50th State Fair, 6-acre yard, est. 1985")).toBe("Operates the 50th State Fair, 6-acre yard, est. 1985");
  });
});

describe("claim domain", () => {
  it("must be configured, real and ours", () => {
    expect(validateClaimDomain(undefined)).toMatchObject({ ok: false });
    expect(validateClaimDomain("<CLAIM_DOMAIN>")).toMatchObject({ ok: false, reason: expect.stringMatching(/placeholder/) });
    expect(validateClaimDomain("claims.example.com")).toMatchObject({ ok: false });
    expect(validateClaimDomain("gmail.com")).toMatchObject({ ok: false });
    expect(validateClaimDomain("me@claims.co")).toMatchObject({ ok: false });
    expect(validateClaimDomain(" Claims.Carnival-Owned.com ")).toEqual({ ok: true, domain: DOMAIN });
  });
});

describe("payload", () => {
  it("keeps the visibility split, drops research notes and sources, puts metadata in the operator call", () => {
    const row = twoRows().eligible[0] as CompanyRow;
    const { create, metadata } = buildPayload(row, DOMAIN);
    expect(create.email).toBe(`acme-shows@${DOMAIN}`);
    expect(create.publicData).toEqual({ companyName: "Acme Shows", hqCity: "Fairbury", hqState: "IL", statesServed: ["IL"], website: "https://acme.example/", otherOperations: ["Games"] });
    expect(create.protectedData).toEqual({ phoneNumber: "815-555-0101" });
    expect(create.privateData).toMatchObject({ contactEmail: "jane@acme.example", hqStreet: "12 Fair Rd", owners: [{ name: "Jane Roe", title: "Owner" }], importExternalId: "cw-1" });
    expect(create.privateData).not.toHaveProperty("researchNotes");
    expect(create.privateData).not.toHaveProperty("sources");
    expect(JSON.stringify(create)).not.toContain("linkedin");
    expect(create).not.toHaveProperty("metadata");
    expect(metadata).toEqual({ claimStatus: "unclaimed", importBatch: IMPORT_BATCH, companyId: "acme-shows", importSource: "cw_directory", researchStatus: "active" });
    // Nothing private or internal is in the public parts.
    const publicParts = JSON.stringify([create.displayName, create.bio, create.publicData, metadata]);
    for (const s of ["jane@", "12 Fair Rd", "61739", "Jane Roe", "cw-1", "Phone on site"]) expect(publicParts).not.toContain(s);
  });
});

describe("import run", () => {
  it("creates once, then a rerun creates nothing, writes no credentials and never resets anything", async () => {
    const rows = twoRows().eligible;
    const api = new FakeApi();
    const first = deps(api);
    await runImport(rows, DOMAIN, first.d);
    expect(first.ledger.map((e) => e.outcome).sort()).toEqual(["created", "created"]);
    expect(Object.keys(first.mapping).sort()).toEqual(["cw-1", "cw-2"]);
    expect([...api.users.values()].every((u) => u.metadata.claimStatus === "unclaimed" && !u.emailVerified && !u.stripeConnected)).toBe(true);

    api.calls = [];
    const second = deps(api, first.mapping);
    await runImport(rows, DOMAIN, second.d);
    expect(second.ledger.map((e) => e.outcome)).toEqual(["exists", "exists"]);
    expect(api.calls.filter((c) => /^(create|setMetadata)/.test(c))).toEqual([]);
    expect(api.users.size).toBe(2);

    // No password ever reaches the ledger or the mapping.
    const persisted = JSON.stringify([first.ledger, second.ledger, first.mapping]);
    for (const pw of api.passwords) expect(persisted).not.toContain(pw);
  });

  it("without the mapping file, finds the existing account by email instead of creating a duplicate", async () => {
    const rows = twoRows().eligible;
    const api = new FakeApi();
    await runImport(rows, DOMAIN, deps(api).d);
    api.calls = [];
    const lost = deps(api, {});
    await runImport(rows, DOMAIN, lost.d);
    expect(lost.ledger.map((e) => e.outcome)).toEqual(["exists", "exists"]);
    expect(api.calls.some((c) => c.startsWith("create"))).toBe(false);
    expect(Object.keys(lost.mapping).sort()).toEqual(["cw-1", "cw-2"]);
  });

  it("resumes an account interrupted between create and metadata", async () => {
    const [row] = twoRows().eligible;
    const api = new FakeApi();
    api.failMetadataOnce = true;
    const first = deps(api);
    await runImport([row], DOMAIN, first.d);
    expect(first.ledger[0]).toMatchObject({ outcome: "failed", userId: "u-1" });
    expect(first.mapping["cw-1"].userId).toBe("u-1"); // mapping saved before metadata

    const second = deps(api, first.mapping);
    await runImport([row], DOMAIN, second.d);
    expect(second.ledger[0]).toMatchObject({ outcome: "resumed", userId: "u-1" });
    expect(api.users.size).toBe(1);
    expect(api.users.get("u-1")!.metadata.claimStatus).toBe("unclaimed");
  });

  it("leaves claimed or verified accounts untouched", async () => {
    const [row] = twoRows().eligible;
    const api = new FakeApi();
    const first = deps(api);
    await runImport([row], DOMAIN, first.d);
    api.users.get("u-1")!.metadata.claimStatus = "claimed";
    api.users.get("u-1")!.metadata.companyId = "renamed-by-owner";
    api.calls = [];
    const second = deps(api, first.mapping);
    await runImport([row], DOMAIN, second.d);
    expect(second.ledger[0]).toMatchObject({ outcome: "skipped_claimed" });
    expect(api.calls.filter((c) => /^(create|setMetadata)/.test(c))).toEqual([]);

    api.users.get("u-1")!.metadata.claimStatus = "unclaimed";
    api.users.get("u-1")!.emailVerified = true;
    const third = deps(api, first.mapping);
    await runImport([row], DOMAIN, third.d);
    expect(third.ledger[0]).toMatchObject({ outcome: "skipped_claimed", detail: "email verified since import" });
  });

  it("never adopts an account it did not create, and never recreates a deleted mapped account", async () => {
    const [row] = twoRows().eligible;
    const api = new FakeApi();
    api.users.set("x-1", { id: "x-1", email: `acme-shows@${DOMAIN}`, emailVerified: false, stripeConnected: false, metadata: {}, privateData: {} });
    const d1 = deps(api);
    await runImport([row], DOMAIN, d1.d);
    expect(d1.ledger[0]).toMatchObject({ outcome: "conflict", userId: "x-1" });
    expect(d1.mapping).toEqual({});

    const api2 = new FakeApi();
    const d2 = deps(api2, { "cw-1": { userId: "gone", email: "", companyId: "acme-shows", createdAt: "" } });
    await runImport([row], DOMAIN, d2.d);
    expect(d2.ledger[0]).toMatchObject({ outcome: "failed" });
    expect(api2.calls.some((c) => c.startsWith("create"))).toBe(false);
  });

  it("redacts credentials from error text", () => {
    expect(redact('bad {"password":"hunter2"} Bearer abc.def client_secret=xyz')).toBe('bad {"password":"[redacted]"} Bearer [redacted] client_secret=[redacted]');
  });
});

// The real workbook (gitignored extract) when present: the counts the import contract promises.
const EXTRACT = "imports/company-accounts/source/workbook.json";
describe.skipIf(!fs.existsSync(EXTRACT))("Carnival_Host_Import.xlsx extract", () => {
  it("184 eligible (119 A + 65 B), 135 held, 11 excluded, no validation issues", () => {
    const p = planImport(JSON.parse(fs.readFileSync(EXTRACT, "utf8")));
    expect(p.issues).toEqual([]);
    expect(p.eligible).toHaveLength(184);
    expect(p.eligible.filter((r) => r.importTier === "A_ready")).toHaveLength(119);
    expect(p.held).toHaveLength(135);
    expect(p.excludedCompanies).toHaveLength(11);
    for (const r of p.eligible) {
      const { create, metadata } = buildPayload(r, DOMAIN);
      expect(Buffer.byteLength(JSON.stringify(create.privateData))).toBeLessThan(50_000);
      expect(metadata.claimStatus).toBe("unclaimed");
      expect(create.privateData).not.toHaveProperty("researchNotes");
    }
  });
});
