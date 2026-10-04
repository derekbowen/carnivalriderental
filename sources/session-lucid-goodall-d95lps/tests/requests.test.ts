import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { handleAcceptQuote, handleCreateRequest, handleGetPublic } from "@/lib/requests/handlers";
import {
  addSupplierToRequest,
  createSupplier,
  getRequestByReference,
  projectContribution,
  recordSupplierQuote,
  sendCustomerQuote,
  setAssignmentStage,
  setSupplierStatus,
  transition,
  assignments,
  latestSupplierQuote,
} from "@/lib/requests/repo";
import { toPublicRequest } from "@/lib/requests/public";
import { briefBody, freshDb } from "./helpers";

beforeAll(() => {
  process.env.SHOW_FIXTURES = "on";
  process.env.REQUEST_TOKEN_SECRET = "test-secret-test-secret-test-secret-123";
});

const tokenFrom = (statusUrl: string) => new URL(statusUrl, "http://x").searchParams.get("t")!;

describe("submitting an event request", () => {
  it("persists the request and it survives reopening the database (reload)", () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bac-")), "t.sqlite");
    const db1 = openDb(file);
    const res = handleCreateRequest(db1, briefBody());
    expect(res.status).toBe(201);
    db1.close();

    const db2 = openDb(file);
    const ref = res.body.reference as string;
    const again = handleGetPublic(db2, ref, tokenFrom(res.body.statusUrl as string));
    expect(again.status).toBe(200);
    const pub = again.body.request as { reference: string; fulfillment: { status: string } };
    expect(pub.reference).toBe(ref);
    expect(pub.fulfillment.status).toBe("submitted");
  });

  it("accepts “Not sure” for every technical site question", () => {
    const res = handleCreateRequest(freshDb(), briefBody());
    expect(res.status).toBe(201);
  });

  it("returns field errors instead of saving an incomplete brief", () => {
    const db = freshDb();
    const res = handleCreateRequest(db, briefBody({ contactEmail: "nope", dateStart: "2000-01-01" }));
    expect(res.status).toBe(422);
    expect(res.body.fields).toMatchObject({ contactEmail: expect.any(String), dateStart: expect.any(String) });
    expect(db.prepare("SELECT COUNT(*) AS n FROM event_requests").get()).toEqual({ n: 0 });
  });

  it("never reports success when persistence fails", () => {
    const db = freshDb();
    db.exec("DROP TABLE request_history"); // the insert's transaction will fail
    const res = handleCreateRequest(db, briefBody());
    expect(res.status).toBe(503);
    expect(res.body.reference).toBeUndefined();
    expect(res.body.statusUrl).toBeUndefined();
    expect(db.prepare("SELECT COUNT(*) AS n FROM event_requests").get()).toEqual({ n: 0 });
  });

  it("does not create a duplicate when the same submission is repeated", () => {
    const db = freshDb();
    const body = briefBody();
    const a = handleCreateRequest(db, body);
    const b = handleCreateRequest(db, body);
    expect(a.status).toBe(201);
    expect(b.status).toBe(200);
    expect(b.body.duplicate).toBe(true);
    expect(b.body.reference).toBe(a.body.reference);
    expect(b.body.statusUrl).toBe(a.body.statusUrl);
    expect(db.prepare("SELECT COUNT(*) AS n FROM event_requests").get()).toEqual({ n: 1 });
  });

  it("refuses a reused key with a different brief", () => {
    const db = freshDb();
    const body = briefBody();
    handleCreateRequest(db, body);
    const res = handleCreateRequest(db, { ...body, city: "Dallas" });
    expect(res.status).toBe(409);
  });

  it("requires the status link token", () => {
    const db = freshDb();
    const res = handleCreateRequest(db, briefBody());
    expect(handleGetPublic(db, res.body.reference as string, "wrong").status).toBe(404);
    expect(handleGetPublic(db, res.body.reference as string, null).status).toBe(404);
  });
});

function sourcedRequest() {
  const db = freshDb();
  const res = handleCreateRequest(db, briefBody());
  const r = getRequestByReference(db, res.body.reference as string)!;
  const supplier = createSupplier(db, { name: "Example Amusements (fixture)", isFixture: true });
  addSupplierToRequest(db, r.id, supplier.id, "team:test");
  const a = assignments(db, r.id)[0];
  return { db, r, supplier, a, token: tokenFrom(res.body.statusUrl as string), reference: r.reference };
}

describe("customers never see internal procurement data", () => {
  it("the public projection has no supplier, cost or margin fields", () => {
    const { db, r, a } = sourcedRequest();
    recordSupplierQuote(db, a.id, { supplierQuoteCents: 1_200_000, transportCents: 150_000 }, "team:test");
    transition(db, r.id, "sourcing", "team:test");
    sendCustomerQuote(db, r.id, { priceCents: 2_200_000, scope: "Ferris wheel, crew, 10am–8pm" }, "team:test");
    const json = JSON.stringify(toPublicRequest(db, r));
    for (const forbidden of ["supplier", "Example Amusements", "1200000", "150000", "transport", "margin", "contribution", "next_action", "nextAction", "team:"]) {
      expect(json).not.toContain(forbidden);
    }
    expect(json).toContain("2200000"); // the customer's own quote is visible
  });
});

describe("supply and confirmation guards", () => {
  it("a researched (unverified) supplier cannot be committed", () => {
    const { db, a } = sourcedRequest();
    recordSupplierQuote(db, a.id, { supplierQuoteCents: 1_000_000 }, "team:test");
    expect(() => setAssignmentStage(db, a.id, "committed", "team:test")).toThrow(/verified/);
  });

  it("a supplier cannot be marked quoted or committed without a recorded quote", () => {
    const { db, a, supplier } = sourcedRequest();
    setSupplierStatus(db, supplier.id, "verified");
    expect(() => setAssignmentStage(db, a.id, "quoted", "team:test")).toThrow(/quote/);
    expect(() => setAssignmentStage(db, a.id, "committed", "team:test")).toThrow(/quote/);
  });

  it("supplier_committed requires the customer's acceptance and a committed supplier", () => {
    const { db, r } = sourcedRequest();
    transition(db, r.id, "sourcing", "team:test");
    expect(() => transition(db, r.id, "supplier_committed", "team:test")).toThrow(/Can't move/);
  });

  it("only the customer's action moves a quote to accepted, and only for the open quote", () => {
    const { db, r, reference, token } = sourcedRequest();
    transition(db, r.id, "sourcing", "team:test");
    expect(() => transition(db, r.id, "quote_accepted" as never, "team:test")).toThrow();
    sendCustomerQuote(db, r.id, { priceCents: 2_000_000, scope: "v1" }, "team:test");
    sendCustomerQuote(db, r.id, { priceCents: 2_100_000, scope: "v2" }, "team:test");
    const pub = toPublicRequest(db, r);
    expect(pub.quote?.version).toBe(2);
    const v1 = db.prepare("SELECT id FROM customer_quotes WHERE version = 1").get() as { id: string };
    expect(handleAcceptQuote(db, reference, { token, quoteId: v1.id }).status).toBe(409);
    expect(handleAcceptQuote(db, reference, { token: "bad", quoteId: pub.quote!.id }).status).toBe(404);
    const ok = handleAcceptQuote(db, reference, { token, quoteId: pub.quote!.id });
    expect(ok.status).toBe(200);
    expect((ok.body.request as { fulfillment: { status: string } }).fulfillment.status).toBe("quote_accepted");
  });

  it("a booking can never be confirmed before a payment policy is approved", () => {
    const { db, r, a, supplier, reference, token } = sourcedRequest();
    setSupplierStatus(db, supplier.id, "verified");
    recordSupplierQuote(db, a.id, { supplierQuoteCents: 1_000_000 }, "team:test");
    setAssignmentStage(db, a.id, "committed", "team:test");
    transition(db, r.id, "sourcing", "team:test");
    sendCustomerQuote(db, r.id, { priceCents: 2_000_000, scope: "scope" }, "team:test");
    handleAcceptQuote(db, reference, { token, quoteId: toPublicRequest(db, r).quote!.id });
    transition(db, r.id, "supplier_committed", "team:test");
    expect(() => transition(db, r.id, "confirmed", "team:test")).toThrow(/payment policy/);
    const pub = toPublicRequest(db, getRequestByReference(db, reference)!);
    expect(pub.fulfillment.status).toBe("supplier_committed");
    expect(pub.fulfillment.label).not.toMatch(/confirmed|booked/i);
    expect(pub.payment.status).toBe("not_started");
  });

  it("only one supplier can be committed per event", () => {
    const { db, r, a, supplier } = sourcedRequest();
    const s2 = createSupplier(db, { name: "Second (fixture)", isFixture: true });
    for (const s of [supplier, s2]) setSupplierStatus(db, s.id, "verified");
    addSupplierToRequest(db, r.id, s2.id, "team:test");
    const a2 = assignments(db, r.id).find((x) => x.supplier_id === s2.id)!;
    for (const x of [a, a2]) recordSupplierQuote(db, x.id, { supplierQuoteCents: 1 }, "team:test");
    setAssignmentStage(db, a.id, "committed", "team:test");
    expect(() => setAssignmentStage(db, a2.id, "committed", "team:test")).toThrow(/already committed/);
  });

  it("supplier quotes are versioned, keeping earlier versions", () => {
    const { db, a } = sourcedRequest();
    recordSupplierQuote(db, a.id, { supplierQuoteCents: 100 }, "team:test");
    recordSupplierQuote(db, a.id, { supplierQuoteCents: 200 }, "team:test");
    expect(latestSupplierQuote(db, a.id)?.version).toBe(2);
    expect(db.prepare("SELECT COUNT(*) AS n FROM supplier_quotes").get()).toEqual({ n: 2 });
  });
});

describe("projected contribution", () => {
  it("is withheld without a supplier quote and lists unknown costs otherwise", () => {
    expect(projectContribution(2_200_000, undefined).cents).toBeNull();
    const p = projectContribution(2_200_000, {
      id: "q", request_supplier_id: "a", version: 1, supplier_quote_cents: 1_200_000,
      transport_cents: 100_000, crew_cents: null, other_cents: null, scope: null, created_at: "",
    });
    expect(p.cents).toBe(900_000);
    expect(p.unknown).toEqual(["setup, teardown & crew", "other fulfillment costs", "payment costs"]);
  });
});
