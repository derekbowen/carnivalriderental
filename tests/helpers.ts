import crypto from "node:crypto";
import { openDb } from "@/lib/requests/db";
import { RequestService } from "@/lib/requests/service";
import type { CreateRequestInput } from "@/lib/requests/schema";

process.env.REQUEST_TOKEN_SECRET ||= "test-secret-test-secret-test-secret";

export function memoryService() {
  const db = openDb(":memory:");
  return { db, svc: new RequestService(db) };
}

export function futureDate(days = 120): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

export function validBody(overrides: Partial<CreateRequestInput["brief"]> = {}) {
  return {
    idempotencyKey: crypto.randomUUID(),
    acknowledgedNotABooking: true as const,
    brief: {
      rideSlug: "ferris-wheel-rental",
      rideFlexibility: "open_to_similar" as const,
      eventDateStart: futureDate(),
      eventDateEnd: null,
      dateFlexibility: "fixed" as const,
      operatingHours: "10am–6pm",
      city: "Austin",
      state: "TX",
      venueName: null,
      eventType: "festival" as const,
      expectedAttendance: "2000_10000" as const,
      budget: "10k_25k" as const,
      siteSurface: "not_sure" as const,
      availableSpace: null,
      power: "not_sure" as const,
      siteAccess: null,
      notes: null,
      contact: { name: "Test Planner", email: "planner@example.com", phone: null, organization: null },
      ...overrides,
    },
  };
}

/** Drive a request to supplier_committed via the real service rules. */
export function seedToCommitted(svc: RequestService) {
  const { request } = svc.createRequest(validBody() as CreateRequestInput, { isTestData: true });
  const supplier = svc.addSupplier({ name: "Fictional Verified Operator", relationship: "verified_supplier", region: null, notes: null, isDemo: true });
  const unit = svc.addUnit({ supplierId: supplier.id, rideSlug: "ferris-wheel-rental", description: "Fictional unit", homeBase: null, verification: "unverified", isDemo: true });
  svc.teamTransition(request.id, "in_review", null);
  svc.teamTransition(request.id, "sourcing", null);
  const cand = svc.addCandidate(request.id, supplier.id, unit.id, null);
  svc.recordSupplierQuote({ requestId: request.id, supplierId: supplier.id, supplierPriceCents: 1_200_000, transportCents: 200_000, crewCents: null, otherCents: null, notes: "SECRET-SUPPLIER-NOTE" });
  const quote = svc.createQuoteDraft(request.id, 2_200_000, "Ferris wheel, crew, one operating day");
  svc.sendQuote(quote.id);
  svc.acceptQuote(request.id, quote.id);
  svc.commitSupplier(request.id, cand.id, null);
  return { request, supplier, unit, cand, quote };
}
