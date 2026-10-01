import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { verifyCustomerToken, customerToken } from "@/lib/requests/access";
import { openDb } from "@/lib/requests/db";
import { handleCreateRequest } from "@/lib/requests/http";
import { toPublicView } from "@/lib/requests/projection";
import type { CreateRequestInput } from "@/lib/requests/schema";
import { RequestService } from "@/lib/requests/service";
import { interpretCreateResponse } from "@/lib/requests/submit";
import { memoryService, seedToCommitted, validBody } from "./helpers";

describe("request persistence", () => {
  it("survives a reload: a new connection to the same file reads the request back", () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bac-")), "t.sqlite");
    const first = new RequestService(openDb(file));
    const res = handleCreateRequest(validBody(), first);
    expect(res.status).toBe(201);

    const reloaded = new RequestService(openDb(file));
    const found = reloaded.getByReference(String(res.body.reference));
    expect(found?.brief.city).toBe("Austin");
    expect(found?.fulfilmentStatus).toBe("submitted");
    expect(found?.paymentStatus).toBe("none");
  });

  it("never reports success when the write fails", () => {
    const { db, svc } = memoryService();
    db.close(); // simulate the store being unavailable
    const res = handleCreateRequest(validBody(), svc);
    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
    expect(res.body.persisted).toBeUndefined();
    expect(interpretCreateResponse(res.status, res.body).ok).toBe(false);
  });

  it("client only treats a committed write as success", () => {
    expect(interpretCreateResponse(201, { ok: true, persisted: true, statusUrl: "/requests/X?t=y", reference: "X" }).ok).toBe(true);
    expect(interpretCreateResponse(201, { ok: true }).ok).toBe(false); // missing persisted flag
    expect(interpretCreateResponse(500, { ok: true, persisted: true, statusUrl: "/x", reference: "X" }).ok).toBe(false);
    expect(interpretCreateResponse(0, null).ok).toBe(false); // network failure
  });
});

describe("idempotency", () => {
  it("repeated submission with the same key does not create a duplicate", () => {
    const { svc } = memoryService();
    const body = validBody();
    const a = handleCreateRequest(body, svc);
    const b = handleCreateRequest(body, svc);
    const c = handleCreateRequest(body, svc);
    expect(a.status).toBe(201);
    expect(b.status).toBe(200);
    expect(c.status).toBe(200);
    expect(b.body.reference).toBe(a.body.reference);
    expect(b.body.statusUrl).toBe(a.body.statusUrl);
    expect(svc.listRequests()).toHaveLength(1);
  });

  it("reusing a key for different data is rejected", () => {
    const { svc } = memoryService();
    const body = validBody();
    handleCreateRequest(body, svc);
    const changed = { ...body, brief: { ...body.brief, city: "Denver" } };
    expect(handleCreateRequest(changed, svc).status).toBe(409);
    expect(svc.listRequests()).toHaveLength(1);
  });
});

describe("validation", () => {
  it("accepts 'not sure' for every site question", () => {
    const { svc } = memoryService();
    expect(handleCreateRequest(validBody({ siteSurface: "not_sure", power: "not_sure", availableSpace: null, siteAccess: null }), svc).status).toBe(201);
  });
  it("rejects past dates, missing acknowledgement and bad state codes", () => {
    const { svc } = memoryService();
    expect(handleCreateRequest(validBody({ eventDateStart: "2020-01-01" }), svc).status).toBe(400);
    expect(handleCreateRequest({ ...validBody(), acknowledgedNotABooking: false }, svc).status).toBe(400);
    expect(handleCreateRequest(validBody({ state: "Texas" }), svc).status).toBe(400);
    expect(svc.listRequests()).toHaveLength(0);
  });
});

describe("customer access and data exposure", () => {
  it("status links are bound to one request", () => {
    expect(verifyCustomerToken("a", customerToken("a"))).toBe(true);
    expect(verifyCustomerToken("b", customerToken("a"))).toBe(false);
    expect(verifyCustomerToken("a", "")).toBe(false);
  });

  it("public view never contains supplier identities, supplier quotes, costs or drafts", () => {
    const { svc } = memoryService();
    const { request } = seedToCommitted(svc);
    svc.createQuoteDraft(request.id, 9_999_900, "UNSENT-DRAFT-SCOPE");
    const view = toPublicView(svc.getRequest(request.id)!, svc.listQuotes(request.id), svc.listEvents(request.id));
    const json = JSON.stringify(view);
    expect(json).not.toContain("Fictional Verified Operator");
    expect(json).not.toContain("SECRET-SUPPLIER-NOTE");
    expect(json).not.toContain("1200000"); // supplier price
    expect(json).not.toContain("UNSENT-DRAFT-SCOPE");
    const keys: string[] = [];
    JSON.parse(json, (k, v) => (keys.push(k), v));
    expect(keys.filter((k) => /supplier|unit|margin|cost|cents$/i.test(k) && k !== "amountCents")).toEqual([]);
    expect(view.quotes.every((q) => q.status !== ("draft" as string))).toBe(true);
  });
});

describe("fulfilment and payment are separate, and confirmation is guarded", () => {
  it("a saved card or authorization never confirms a booking", () => {
    const { svc } = memoryService();
    const { request } = seedToCommitted(svc);
    svc.recordDemoPayment(request.id, "payment_method_saved", null);
    expect(() => svc.confirmBooking(request.id)).toThrow(/payment_captured/);
    svc.recordDemoPayment(request.id, "funds_authorized", null);
    expect(() => svc.confirmBooking(request.id)).toThrow(/payment_captured/);
    svc.recordDemoPayment(request.id, "payment_captured", null);
    expect(svc.confirmBooking(request.id).fulfilmentStatus).toBe("confirmed");
  });

  it("captured payment alone does not confirm without a committed supplier", () => {
    const { svc } = memoryService();
    const { request } = svc.createRequest(validBody() as CreateRequestInput);
    svc.recordDemoPayment(request.id, "payment_captured", null);
    expect(svc.getRequest(request.id)!.fulfilmentStatus).toBe("submitted");
    expect(() => svc.confirmBooking(request.id)).toThrow(/supplier must be committed/);
  });

  it("a researched prospect cannot be committed", () => {
    const { svc } = memoryService();
    const { request } = svc.createRequest(validBody() as CreateRequestInput);
    const s = svc.addSupplier({ name: "Prospect", relationship: "researched_prospect", region: null, notes: null, isDemo: true });
    const u = svc.addUnit({ supplierId: s.id, rideSlug: "ferris-wheel-rental", description: "x", homeBase: null, verification: "unverified", isDemo: true });
    svc.teamTransition(request.id, "in_review", null);
    svc.teamTransition(request.id, "sourcing", null);
    const cand = svc.addCandidate(request.id, s.id, u.id, null);
    svc.recordSupplierQuote({ requestId: request.id, supplierId: s.id, supplierPriceCents: 1, transportCents: null, crewCents: null, otherCents: null, notes: null });
    const q = svc.createQuoteDraft(request.id, 100, "scope");
    svc.sendQuote(q.id);
    svc.acceptQuote(request.id, q.id);
    expect(() => svc.commitSupplier(request.id, cand.id, null)).toThrow(/verified suppliers/);
  });

  it("team cannot jump straight to protected states", () => {
    const { svc } = memoryService();
    const { request } = svc.createRequest(validBody() as CreateRequestInput);
    for (const to of ["quote_accepted", "supplier_committed", "confirmed"] as const) {
      expect(() => svc.teamTransition(request.id, to, null)).toThrow();
    }
    expect(() => svc.setCandidateStage("x", "committed" as never)).toThrow();
  });

  it("a superseded or withdrawn quote cannot be accepted", () => {
    const { svc } = memoryService();
    const { request } = svc.createRequest(validBody() as CreateRequestInput);
    svc.teamTransition(request.id, "in_review", null);
    svc.teamTransition(request.id, "sourcing", null);
    const v1 = svc.createQuoteDraft(request.id, 100, "v1");
    svc.sendQuote(v1.id);
    const v2 = svc.createQuoteDraft(request.id, 200, "v2");
    svc.sendQuote(v2.id);
    expect(() => svc.acceptQuote(request.id, v1.id)).toThrow(/no longer open/);
    svc.teamTransition(request.id, "sourcing", "re-sourcing");
    expect(() => svc.acceptQuote(request.id, v2.id)).toThrow(/no longer open/);
  });

  it("records an audit trail on both tracks", () => {
    const { svc } = memoryService();
    const { request } = seedToCommitted(svc);
    svc.recordDemoPayment(request.id, "payment_captured", null);
    const tracks = new Set(svc.listEvents(request.id).map((e) => e.track));
    expect(tracks).toEqual(new Set(["fulfilment", "payment", "note"]));
  });
});
