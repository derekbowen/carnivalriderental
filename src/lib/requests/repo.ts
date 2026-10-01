// Event requests and procurement records. Every state change is validated
// here on the server; the UI only asks.
import crypto from "node:crypto";
import { tx, type DB } from "@/lib/db";
import type { EventRequestInput } from "./input";
import {
  CONFIRMATION_PAYMENT_POLICY,
  MANUAL_TRANSITIONS,
  type FulfillmentStatus,
  type PaymentStatus,
} from "./status";

export class RuleError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly httpStatus = 409,
  ) {
    super(message);
  }
}

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();

function newReference(): string {
  // Unambiguous characters only (no 0/O, 1/I/L).
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const bytes = crypto.randomBytes(6);
  let s = "";
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return `BAC-${s}`;
}

function payloadHash(input: EventRequestInput): string {
  const { idempotencyKey: _k, ...rest } = input;
  return crypto.createHash("sha256").update(JSON.stringify(rest)).digest("hex");
}

export type EventRequestRow = {
  id: string;
  reference: string;
  ride_slug: string | null;
  ride_flexibility: string;
  date_start: string;
  date_end: string | null;
  date_flexibility: string;
  city: string;
  state: string;
  venue: string | null;
  operating_hours: string | null;
  event_type: string;
  expected_attendance: string | null;
  budget: string | null;
  site_access: string;
  available_space: string;
  power: string;
  notes: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  organization: string | null;
  fulfillment_status: FulfillmentStatus;
  payment_status: PaymentStatus;
  next_action: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerQuoteRow = {
  id: string;
  request_id: string;
  version: number;
  price_cents: number;
  scope: string;
  status: "draft" | "sent" | "accepted" | "superseded" | "withdrawn";
  sent_at: string | null;
  accepted_at: string | null;
  created_at: string;
};

export type HistoryRow = {
  id: number;
  kind: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  actor: string;
  created_at: string;
};

function history(
  db: DB,
  requestId: string,
  e: { kind: string; from?: string | null; to?: string | null; note?: string | null; actor: string },
) {
  db.prepare(
    "INSERT INTO request_history (request_id, kind, from_status, to_status, note, actor, created_at) VALUES (?,?,?,?,?,?,?)",
  ).run(requestId, e.kind, e.from ?? null, e.to ?? null, e.note ?? null, e.actor, now());
}

// ── Customer side ───────────────────────────────────────────────────────────

/**
 * Persist a new event request. Idempotent on the client's key: a retry with
 * the same key and the same brief returns the original request; the same key
 * with a different brief is refused.
 */
export function createEventRequest(
  db: DB,
  input: EventRequestInput,
): { request: EventRequestRow; created: boolean } {
  const hash = payloadHash(input);
  return tx(db, () => {
    const existing = db
      .prepare("SELECT * FROM event_requests WHERE idempotency_key = ?")
      .get(input.idempotencyKey) as (EventRequestRow & { payload_hash: string }) | undefined;
    if (existing) {
      if (existing.payload_hash !== hash) {
        throw new RuleError(
          "This request key was already used for a different request. Reload the page to start a new one.",
          "idempotency_conflict",
        );
      }
      return { request: existing, created: false };
    }
    const row = { id: id(), reference: newReference(), ts: now() };
    db.prepare(
      `INSERT INTO event_requests (
         id, reference, idempotency_key, payload_hash, ride_slug, ride_flexibility, date_start, date_end,
         date_flexibility, city, state, venue, operating_hours, event_type, expected_attendance, budget,
         site_access, available_space, power, notes, contact_name, contact_email, contact_phone, organization,
         fulfillment_status, payment_status, next_action, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'submitted','not_started','Review brief and start sourcing',?,?)`,
    ).run(
      row.id, row.reference, input.idempotencyKey, hash, input.rideSlug, input.rideFlexibility,
      input.dateStart, input.dateEnd, input.dateFlexibility, input.city, input.state, input.venue,
      input.operatingHours, input.eventType, input.expectedAttendance, input.budget, input.siteAccess,
      input.availableSpace, input.power, input.notes, input.contactName, input.contactEmail,
      input.contactPhone, input.organization, row.ts, row.ts,
    );
    history(db, row.id, { kind: "status", to: "submitted", actor: "customer" });
    return { request: getRequest(db, row.id)!, created: true };
  });
}

export function getRequest(db: DB, requestId: string): EventRequestRow | undefined {
  return db.prepare("SELECT * FROM event_requests WHERE id = ?").get(requestId) as EventRequestRow | undefined;
}

export function getRequestByReference(db: DB, reference: string): EventRequestRow | undefined {
  return db.prepare("SELECT * FROM event_requests WHERE reference = ?").get(reference) as
    | EventRequestRow
    | undefined;
}

export function customerQuotes(db: DB, requestId: string): CustomerQuoteRow[] {
  return db
    .prepare("SELECT * FROM customer_quotes WHERE request_id = ? ORDER BY version DESC")
    .all(requestId) as CustomerQuoteRow[];
}

export function requestHistory(db: DB, requestId: string): HistoryRow[] {
  return db
    .prepare("SELECT * FROM request_history WHERE request_id = ? ORDER BY id ASC")
    .all(requestId) as HistoryRow[];
}

/** The customer accepts the current sent quote. */
export function acceptQuote(db: DB, requestId: string, quoteId: string) {
  return tx(db, () => {
    const req = getRequest(db, requestId);
    if (!req) throw new RuleError("Request not found.", "not_found", 404);
    if (req.fulfillment_status !== "quote_sent")
      throw new RuleError("There is no quote waiting for your decision.", "no_open_quote");
    const quote = db
      .prepare("SELECT * FROM customer_quotes WHERE id = ? AND request_id = ?")
      .get(quoteId, requestId) as CustomerQuoteRow | undefined;
    if (!quote || quote.status !== "sent")
      throw new RuleError("That quote is no longer open. Reload to see the latest.", "quote_not_open");
    const ts = now();
    db.prepare("UPDATE customer_quotes SET status = 'accepted', accepted_at = ? WHERE id = ?").run(ts, quote.id);
    db.prepare(
      "UPDATE event_requests SET fulfillment_status = 'quote_accepted', next_action = ?, updated_at = ? WHERE id = ?",
    ).run("Secure the committed operator", ts, requestId);
    history(db, requestId, {
      kind: "status",
      from: "quote_sent",
      to: "quote_accepted",
      note: `Accepted quote v${quote.version}`,
      actor: "customer",
    });
  });
}

// ── Internal team side ──────────────────────────────────────────────────────

export function listRequests(db: DB): EventRequestRow[] {
  return db.prepare("SELECT * FROM event_requests ORDER BY created_at DESC").all() as EventRequestRow[];
}

export function setNextAction(db: DB, requestId: string, nextAction: string, actor: string) {
  const req = getRequest(db, requestId);
  if (!req) throw new RuleError("Request not found.", "not_found", 404);
  db.prepare("UPDATE event_requests SET next_action = ?, updated_at = ? WHERE id = ?").run(
    nextAction.slice(0, 300) || null,
    now(),
    requestId,
  );
  history(db, requestId, { kind: "note", note: `Next action: ${nextAction}`, actor });
}

/** A manual status change, checked against the allowed transitions and guards. */
export function transition(db: DB, requestId: string, to: FulfillmentStatus, actor: string, note?: string) {
  return tx(db, () => {
    const req = getRequest(db, requestId);
    if (!req) throw new RuleError("Request not found.", "not_found", 404);
    const from = req.fulfillment_status;
    if (!MANUAL_TRANSITIONS[from]?.includes(to))
      throw new RuleError(`Can't move a request from ${from} to ${to}.`, "invalid_transition");

    if (to === "supplier_committed") {
      const committed = committedAssignment(db, requestId);
      if (!committed)
        throw new RuleError("Mark a verified supplier as committed for this event first.", "no_committed_supplier");
    }
    if (to === "confirmed") {
      if (!CONFIRMATION_PAYMENT_POLICY.approved)
        throw new RuleError(
          "Booking confirmation is disabled until a payment policy is approved.",
          "payment_policy_not_approved",
        );
      if (!CONFIRMATION_PAYMENT_POLICY.requires.includes(req.payment_status))
        throw new RuleError("The payment requirement for confirmation is not met.", "payment_requirement_unmet");
      if (!committedAssignment(db, requestId))
        throw new RuleError("No supplier is committed for this event.", "no_committed_supplier");
    }

    db.prepare("UPDATE event_requests SET fulfillment_status = ?, updated_at = ? WHERE id = ?").run(
      to,
      now(),
      requestId,
    );
    history(db, requestId, { kind: "status", from, to, note: note ?? null, actor });
  });
}

// Suppliers ------------------------------------------------------------------

export type SupplierRow = {
  id: string;
  name: string;
  status: "researched" | "contacted" | "verified";
  region: string | null;
  contact: string | null;
  notes: string | null;
  is_fixture: number;
};

export function listSuppliers(db: DB): SupplierRow[] {
  return db.prepare("SELECT * FROM suppliers ORDER BY name").all() as SupplierRow[];
}

export function createSupplier(
  db: DB,
  s: { name: string; region?: string | null; contact?: string | null; notes?: string | null; isFixture?: boolean },
): SupplierRow {
  const ts = now();
  const row = { id: id() };
  db.prepare(
    "INSERT INTO suppliers (id, name, status, region, contact, notes, is_fixture, created_at, updated_at) VALUES (?,?,'researched',?,?,?,?,?,?)",
  ).run(row.id, s.name.trim().slice(0, 160), s.region ?? null, s.contact ?? null, s.notes ?? null, s.isFixture ? 1 : 0, ts, ts);
  return db.prepare("SELECT * FROM suppliers WHERE id = ?").get(row.id) as SupplierRow;
}

const SUPPLIER_ORDER = ["researched", "contacted", "verified"] as const;

/** Suppliers move researched → contacted → verified. Verification is a human decision. */
export function setSupplierStatus(db: DB, supplierId: string, status: SupplierRow["status"]) {
  if (!SUPPLIER_ORDER.includes(status)) throw new RuleError("Unknown supplier status.", "bad_status", 400);
  const r = db.prepare("UPDATE suppliers SET status = ?, updated_at = ? WHERE id = ?").run(status, now(), supplierId);
  if (r.changes === 0) throw new RuleError("Supplier not found.", "not_found", 404);
}

export type AssignmentRow = {
  id: string;
  request_id: string;
  supplier_id: string;
  stage: "considering" | "contacted" | "quoted" | "committed" | "declined";
  supplier_name: string;
  supplier_status: SupplierRow["status"];
};

export function assignments(db: DB, requestId: string): AssignmentRow[] {
  return db
    .prepare(
      `SELECT rs.*, s.name AS supplier_name, s.status AS supplier_status
         FROM request_suppliers rs JOIN suppliers s ON s.id = rs.supplier_id
        WHERE rs.request_id = ? ORDER BY rs.created_at`,
    )
    .all(requestId) as AssignmentRow[];
}

function committedAssignment(db: DB, requestId: string): AssignmentRow | undefined {
  return assignments(db, requestId).find((a) => a.stage === "committed");
}

export function addSupplierToRequest(db: DB, requestId: string, supplierId: string, actor: string) {
  if (!getRequest(db, requestId)) throw new RuleError("Request not found.", "not_found", 404);
  const ts = now();
  try {
    db.prepare(
      "INSERT INTO request_suppliers (id, request_id, supplier_id, stage, created_at, updated_at) VALUES (?,?,?,'considering',?,?)",
    ).run(id(), requestId, supplierId, ts, ts);
  } catch {
    throw new RuleError("That supplier is already on this request.", "duplicate_assignment");
  }
  history(db, requestId, { kind: "procurement", note: "Supplier added for consideration", actor });
}

export function setAssignmentStage(
  db: DB,
  assignmentId: string,
  stage: AssignmentRow["stage"],
  actor: string,
) {
  return tx(db, () => {
    const a = db
      .prepare(
        `SELECT rs.*, s.name AS supplier_name, s.status AS supplier_status
           FROM request_suppliers rs JOIN suppliers s ON s.id = rs.supplier_id WHERE rs.id = ?`,
      )
      .get(assignmentId) as AssignmentRow | undefined;
    if (!a) throw new RuleError("Assignment not found.", "not_found", 404);
    if (stage === "quoted" && !latestSupplierQuote(db, assignmentId))
      throw new RuleError("Record the supplier's quote before marking it quoted.", "no_supplier_quote");
    if (stage === "committed") {
      if (a.supplier_status !== "verified")
        throw new RuleError("Only a verified supplier can be committed for an event.", "supplier_not_verified");
      if (!latestSupplierQuote(db, assignmentId))
        throw new RuleError("Record the supplier's quote before committing.", "no_supplier_quote");
      const other = committedAssignment(db, a.request_id);
      if (other && other.id !== a.id)
        throw new RuleError("Another supplier is already committed for this event.", "already_committed");
    }
    db.prepare("UPDATE request_suppliers SET stage = ?, updated_at = ? WHERE id = ?").run(stage, now(), assignmentId);
    history(db, a.request_id, {
      kind: "procurement",
      note: `${a.supplier_name}: ${a.stage} → ${stage}`,
      actor,
    });
  });
}

export type SupplierQuoteRow = {
  id: string;
  request_supplier_id: string;
  version: number;
  supplier_quote_cents: number | null;
  transport_cents: number | null;
  crew_cents: number | null;
  other_cents: number | null;
  scope: string | null;
  created_at: string;
};

export function latestSupplierQuote(db: DB, assignmentId: string): SupplierQuoteRow | undefined {
  return db
    .prepare("SELECT * FROM supplier_quotes WHERE request_supplier_id = ? ORDER BY version DESC LIMIT 1")
    .get(assignmentId) as SupplierQuoteRow | undefined;
}

export function supplierQuotes(db: DB, assignmentId: string): SupplierQuoteRow[] {
  return db
    .prepare("SELECT * FROM supplier_quotes WHERE request_supplier_id = ? ORDER BY version DESC")
    .all(assignmentId) as SupplierQuoteRow[];
}

const cents = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) throw new RuleError("Amounts must be whole cents, zero or more.", "bad_amount", 400);
  return n;
};

/** Each recorded supplier quote is a new version; earlier versions are kept. */
export function recordSupplierQuote(
  db: DB,
  assignmentId: string,
  q: { supplierQuoteCents?: unknown; transportCents?: unknown; crewCents?: unknown; otherCents?: unknown; scope?: unknown },
  actor: string,
) {
  return tx(db, () => {
    const a = db.prepare("SELECT * FROM request_suppliers WHERE id = ?").get(assignmentId) as
      | { request_id: string }
      | undefined;
    if (!a) throw new RuleError("Assignment not found.", "not_found", 404);
    const prev = latestSupplierQuote(db, assignmentId);
    db.prepare(
      `INSERT INTO supplier_quotes (id, request_supplier_id, version, supplier_quote_cents, transport_cents, crew_cents, other_cents, scope, created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    ).run(
      id(), assignmentId, (prev?.version ?? 0) + 1, cents(q.supplierQuoteCents), cents(q.transportCents),
      cents(q.crewCents), cents(q.otherCents), typeof q.scope === "string" ? q.scope.slice(0, 2000) : null, now(),
    );
    history(db, a.request_id, { kind: "procurement", note: `Supplier quote v${(prev?.version ?? 0) + 1} recorded`, actor });
  });
}

// Customer quotes --------------------------------------------------------------

/** Send a new customer quote. Any earlier open quote is superseded. */
export function sendCustomerQuote(db: DB, requestId: string, q: { priceCents: unknown; scope: unknown }, actor: string) {
  return tx(db, () => {
    const req = getRequest(db, requestId);
    if (!req) throw new RuleError("Request not found.", "not_found", 404);
    if (!["sourcing", "quote_sent"].includes(req.fulfillment_status))
      throw new RuleError("Quotes can be sent only while sourcing or revising a sent quote.", "invalid_state");
    const price = cents(q.priceCents);
    if (!price) throw new RuleError("Enter the customer price.", "bad_amount", 400);
    const scope = typeof q.scope === "string" ? q.scope.trim().slice(0, 4000) : "";
    if (!scope) throw new RuleError("Describe the scope the customer is accepting.", "no_scope", 400);

    const ts = now();
    db.prepare("UPDATE customer_quotes SET status = 'superseded' WHERE request_id = ? AND status = 'sent'").run(requestId);
    const prev = db.prepare("SELECT MAX(version) AS v FROM customer_quotes WHERE request_id = ?").get(requestId) as {
      v: number | null;
    };
    const version = (prev.v ?? 0) + 1;
    db.prepare(
      "INSERT INTO customer_quotes (id, request_id, version, price_cents, scope, status, sent_at, created_at) VALUES (?,?,?,?,?,'sent',?,?)",
    ).run(id(), requestId, version, price, scope, ts, ts);
    db.prepare(
      "UPDATE event_requests SET fulfillment_status = 'quote_sent', next_action = ?, updated_at = ? WHERE id = ?",
    ).run("Wait for the customer's decision", ts, requestId);
    history(db, requestId, {
      kind: "status",
      from: req.fulfillment_status,
      to: "quote_sent",
      note: `Quote v${version} sent`,
      actor,
    });
  });
}

/** Withdraw the open quote and go back to sourcing. */
export function withdrawCustomerQuote(db: DB, requestId: string, actor: string) {
  return tx(db, () => {
    const req = getRequest(db, requestId);
    if (!req) throw new RuleError("Request not found.", "not_found", 404);
    if (req.fulfillment_status !== "quote_sent") throw new RuleError("There is no open quote to withdraw.", "invalid_state");
    db.prepare("UPDATE customer_quotes SET status = 'withdrawn' WHERE request_id = ? AND status = 'sent'").run(requestId);
    db.prepare("UPDATE event_requests SET fulfillment_status = 'sourcing', updated_at = ? WHERE id = ?").run(now(), requestId);
    history(db, requestId, { kind: "status", from: "quote_sent", to: "sourcing", note: "Quote withdrawn", actor });
  });
}

/**
 * Projected contribution for one supplier option: customer price minus the
 * costs we know. Unknown costs stay unknown and are listed; payment costs are
 * always listed as unknown until the payment policy is decided. Without a
 * customer price and a supplier quote there is no projection at all.
 */
export function projectContribution(
  customerPriceCents: number | null,
  q: SupplierQuoteRow | undefined,
): { cents: number | null; unknown: string[] } {
  const costs: [string, number | null | undefined][] = [
    ["supplier quote", q?.supplier_quote_cents],
    ["transport & mobilization", q?.transport_cents],
    ["setup, teardown & crew", q?.crew_cents],
    ["other fulfillment costs", q?.other_cents],
  ];
  const unknown = costs.filter(([, v]) => v === null || v === undefined).map(([k]) => k);
  unknown.push("payment costs");
  if (customerPriceCents === null || q?.supplier_quote_cents == null) {
    return { cents: null, unknown: customerPriceCents === null ? ["customer price", ...unknown] : unknown };
  }
  const known = costs.reduce((sum, [, v]) => sum + (v ?? 0), 0);
  return { cents: customerPriceCents - known, unknown };
}
