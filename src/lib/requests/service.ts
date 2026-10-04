import crypto from "node:crypto";
import { onPaymentAuthorized, onQuoteSent, onRequestCreated } from "../email/notify";
import type { Db } from "./db";
import type { CreateRequestInput } from "./schema";
import { canTransition, canTransitionPayment, outreachAllowed, PAYMENT_POLICY } from "./state";
import type {
  CandidateStage,
  CustomerQuote,
  EventBrief,
  EventRequest,
  FulfilmentStatus,
  PaymentStatus,
  RequestSupplier,
  RideUnit,
  StatusEvent,
  Supplier,
  SupplierQuote,
} from "./types";

export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: "not_found" | "conflict" | "invalid_state" | "forbidden" | "payment_required",
  ) {
    super(message);
  }
}

type Row = Record<string, unknown>;
const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

const REF_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
function newReference(): string {
  const bytes = crypto.randomBytes(6);
  let out = "";
  for (const b of bytes) out += REF_ALPHABET[b % REF_ALPHABET.length];
  return `BAC-${out}`;
}

/** Stable hash of the submitted payload so an idempotency key cannot be reused for different data. */
function payloadHash(brief: EventBrief): string {
  return crypto.createHash("sha256").update(JSON.stringify(brief)).digest("hex");
}

function mapRequest(r: Row): EventRequest {
  return {
    id: String(r.id),
    reference: String(r.reference),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    brief: JSON.parse(String(r.brief_json)) as EventBrief,
    fulfilmentStatus: r.fulfilment_status as FulfilmentStatus,
    paymentStatus: r.payment_status as PaymentStatus,
    paymentMode: "demo",
    isTestData: Number(r.is_test_data) === 1,
    assignedSupplierId: str(r.assigned_supplier_id),
    assignedUnitId: str(r.assigned_unit_id),
  };
}

function mapQuote(r: Row): CustomerQuote {
  return {
    id: String(r.id),
    requestId: String(r.request_id),
    version: Number(r.version),
    amountCents: Number(r.amount_cents),
    scope: String(r.scope),
    status: r.status as CustomerQuote["status"],
    createdAt: String(r.created_at),
    sentAt: str(r.sent_at),
    acceptedAt: str(r.accepted_at),
  };
}

export class RequestService {
  constructor(private readonly db: Db) {}

  /** Run fn inside a write transaction; roll back on any error. */
  private tx<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const out = fn();
      this.db.exec("COMMIT");
      return out;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }

  private event(e: Omit<StatusEvent, "id" | "createdAt">) {
    this.db
      .prepare(
        `INSERT INTO status_events (id, request_id, track, from_status, to_status, actor, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(uuid(), e.requestId, e.track, e.fromStatus, e.toStatus, e.actor, e.note, now());
  }

  private setFulfilment(req: EventRequest, to: FulfilmentStatus, actor: StatusEvent["actor"], note: string | null) {
    if (!canTransition(req.fulfilmentStatus, to)) {
      throw new DomainError(`Cannot move request from ${req.fulfilmentStatus} to ${to}`, "invalid_state");
    }
    this.db
      .prepare(`UPDATE event_requests SET fulfilment_status = ?, updated_at = ? WHERE id = ?`)
      .run(to, now(), req.id);
    this.event({ requestId: req.id, track: "fulfilment", fromStatus: req.fulfilmentStatus, toStatus: to, actor, note });
  }

  // ---------- customer-facing ----------

  /**
   * Idempotent create. The same idempotency key with the same payload returns the
   * existing request (created=false). The same key with a different payload is a conflict.
   */
  createRequest(input: CreateRequestInput, opts: { isTestData?: boolean } = {}): { request: EventRequest; created: boolean } {
    const hash = payloadHash(input.brief);
    return this.tx(() => {
      const existing = this.db
        .prepare(`SELECT * FROM event_requests WHERE idempotency_key = ?`)
        .get(input.idempotencyKey) as Row | undefined;
      if (existing) {
        if (existing.payload_hash !== hash) {
          throw new DomainError("This submission key was already used for a different request", "conflict");
        }
        return { request: mapRequest(existing), created: false };
      }
      const id = uuid();
      const ts = now();
      let reference = newReference();
      while (this.db.prepare(`SELECT 1 FROM event_requests WHERE reference = ?`).get(reference)) {
        reference = newReference();
      }
      this.db
        .prepare(
          `INSERT INTO event_requests
             (id, reference, idempotency_key, payload_hash, brief_json, fulfilment_status, payment_status,
              payment_mode, is_test_data, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'submitted', 'none', 'demo', ?, ?, ?)`,
        )
        .run(id, reference, input.idempotencyKey, hash, JSON.stringify(input.brief), opts.isTestData ? 1 : 0, ts, ts);
      this.event({ requestId: id, track: "fulfilment", fromStatus: null, toStatus: "submitted", actor: "customer", note: null });
      const request = this.mustGet(id);
      onRequestCreated(this.db, request);
      return { request, created: true };
    });
  }

  acceptQuote(requestId: string, quoteId: string): EventRequest {
    return this.tx(() => {
      const req = this.mustGet(requestId);
      const quote = this.getQuote(quoteId);
      if (!quote || quote.requestId !== requestId) throw new DomainError("Quote not found", "not_found");
      if (quote.status !== "sent") throw new DomainError("This quote is no longer open for acceptance", "invalid_state");
      const latest = this.latestSentQuote(requestId);
      if (!latest || latest.id !== quote.id) throw new DomainError("A newer quote replaced this one", "invalid_state");
      this.setFulfilment(req, "quote_accepted", "customer", `Accepted quote v${quote.version}`);
      this.db
        .prepare(`UPDATE customer_quotes SET status = 'accepted', accepted_at = ? WHERE id = ?`)
        .run(now(), quote.id);
      return this.mustGet(requestId);
    });
  }

  cancelByCustomer(requestId: string): EventRequest {
    return this.tx(() => {
      const req = this.mustGet(requestId);
      this.setFulfilment(req, "cancelled", "customer", "Withdrawn by customer");
      return this.mustGet(requestId);
    });
  }

  // ---------- reads ----------

  getRequest(id: string): EventRequest | null {
    const r = this.db.prepare(`SELECT * FROM event_requests WHERE id = ?`).get(id) as Row | undefined;
    return r ? mapRequest(r) : null;
  }

  getByReference(reference: string): EventRequest | null {
    const r = this.db.prepare(`SELECT * FROM event_requests WHERE reference = ?`).get(reference) as Row | undefined;
    return r ? mapRequest(r) : null;
  }

  private mustGet(id: string): EventRequest {
    const r = this.getRequest(id);
    if (!r) throw new DomainError("Request not found", "not_found");
    return r;
  }

  listRequests(): EventRequest[] {
    return (this.db.prepare(`SELECT * FROM event_requests ORDER BY created_at DESC`).all() as Row[]).map(mapRequest);
  }

  listQuotes(requestId: string): CustomerQuote[] {
    return (
      this.db.prepare(`SELECT * FROM customer_quotes WHERE request_id = ? ORDER BY version`).all(requestId) as Row[]
    ).map(mapQuote);
  }

  getQuote(id: string): CustomerQuote | null {
    const r = this.db.prepare(`SELECT * FROM customer_quotes WHERE id = ?`).get(id) as Row | undefined;
    return r ? mapQuote(r) : null;
  }

  private latestSentQuote(requestId: string): CustomerQuote | null {
    const r = this.db
      .prepare(`SELECT * FROM customer_quotes WHERE request_id = ? AND status = 'sent' ORDER BY version DESC LIMIT 1`)
      .get(requestId) as Row | undefined;
    return r ? mapQuote(r) : null;
  }

  listEvents(requestId: string): StatusEvent[] {
    return (
      this.db
        .prepare(`SELECT * FROM status_events WHERE request_id = ? ORDER BY created_at, rowid`)
        .all(requestId) as Row[]
    ).map((r) => ({
      id: String(r.id),
      requestId: String(r.request_id),
      track: r.track as StatusEvent["track"],
      fromStatus: str(r.from_status),
      toStatus: str(r.to_status),
      actor: r.actor as StatusEvent["actor"],
      note: str(r.note),
      createdAt: String(r.created_at),
    }));
  }

  listSuppliers(): Supplier[] {
    return (this.db.prepare(`SELECT * FROM suppliers ORDER BY name`).all() as Row[]).map((r) => ({
      id: String(r.id),
      name: String(r.name),
      relationship: r.relationship as Supplier["relationship"],
      region: str(r.region),
      notes: str(r.notes),
      isDemo: Number(r.is_demo) === 1,
    }));
  }

  listUnits(): RideUnit[] {
    return (this.db.prepare(`SELECT * FROM ride_units`).all() as Row[]).map((r) => ({
      id: String(r.id),
      supplierId: String(r.supplier_id),
      rideSlug: String(r.ride_slug),
      description: String(r.description),
      homeBase: str(r.home_base),
      verification: r.verification as RideUnit["verification"],
      isDemo: Number(r.is_demo) === 1,
    }));
  }

  listCandidates(requestId: string): RequestSupplier[] {
    return (
      this.db.prepare(`SELECT * FROM request_suppliers WHERE request_id = ? ORDER BY updated_at`).all(requestId) as Row[]
    ).map((r) => ({
      id: String(r.id),
      requestId: String(r.request_id),
      supplierId: String(r.supplier_id),
      unitId: str(r.unit_id),
      stage: r.stage as CandidateStage,
      notes: str(r.notes),
      updatedAt: String(r.updated_at),
    }));
  }

  listSupplierQuotes(requestId: string): SupplierQuote[] {
    return (
      this.db.prepare(`SELECT * FROM supplier_quotes WHERE request_id = ? ORDER BY created_at`).all(requestId) as Row[]
    ).map((r) => ({
      id: String(r.id),
      requestId: String(r.request_id),
      supplierId: String(r.supplier_id),
      supplierPriceCents: num(r.supplier_price_cents),
      transportCents: num(r.transport_cents),
      crewCents: num(r.crew_cents),
      otherCents: num(r.other_cents),
      notes: str(r.notes),
      createdAt: String(r.created_at),
    }));
  }

  // ---------- team actions ----------

  /** Statuses the team may set directly. Others are reached only through their dedicated actions. */
  static readonly TEAM_DIRECT: FulfilmentStatus[] = ["in_review", "sourcing", "unable_to_source", "declined"];

  /** Pay-first gate (OUTREACH_POLICY): throws unless the customer has paid. */
  private assertPaid(req: EventRequest, action: string) {
    if (!outreachAllowed(req.paymentStatus)) {
      throw new DomainError(`Pay-first policy: cannot ${action} until the customer has paid (payment is "${req.paymentStatus}")`, "payment_required");
    }
  }

  teamTransition(requestId: string, to: FulfilmentStatus, note: string | null): EventRequest {
    if (!RequestService.TEAM_DIRECT.includes(to)) {
      throw new DomainError(`"${to}" can only be reached through its dedicated action`, "forbidden");
    }
    return this.tx(() => {
      const req = this.mustGet(requestId);
      if (to === "sourcing") this.assertPaid(req, "start sourcing");
      if (to === "sourcing" && req.fulfilmentStatus === "quote_sent") {
        // Re-opening sourcing withdraws the outstanding quote so the customer cannot accept stale terms.
        this.db.prepare(`UPDATE customer_quotes SET status = 'withdrawn' WHERE request_id = ? AND status = 'sent'`).run(requestId);
      }
      this.setFulfilment(req, to, "team", note);
      return this.mustGet(requestId);
    });
  }

  createQuoteDraft(requestId: string, amountCents: number, scope: string): CustomerQuote {
    if (!Number.isInteger(amountCents) || amountCents <= 0) throw new DomainError("Amount must be positive", "invalid_state");
    if (!scope.trim()) throw new DomainError("Scope is required", "invalid_state");
    return this.tx(() => {
      this.mustGet(requestId);
      const row = this.db
        .prepare(`SELECT COALESCE(MAX(version), 0) AS v FROM customer_quotes WHERE request_id = ?`)
        .get(requestId) as Row;
      const id = uuid();
      this.db
        .prepare(
          `INSERT INTO customer_quotes (id, request_id, version, amount_cents, scope, status, created_at)
           VALUES (?, ?, ?, ?, ?, 'draft', ?)`,
        )
        .run(id, requestId, Number(row.v) + 1, amountCents, scope.trim(), now());
      return this.getQuote(id)!;
    });
  }

  sendQuote(quoteId: string): EventRequest {
    return this.tx(() => {
      const quote = this.getQuote(quoteId);
      if (!quote) throw new DomainError("Quote not found", "not_found");
      if (quote.status !== "draft") throw new DomainError("Only draft quotes can be sent", "invalid_state");
      const req = this.mustGet(quote.requestId);
      this.assertPaid(req, "send a quote to the customer");
      if (req.fulfilmentStatus !== "sourcing" && req.fulfilmentStatus !== "quote_sent") {
        throw new DomainError(`Quotes can be sent while sourcing, not in ${req.fulfilmentStatus}`, "invalid_state");
      }
      this.db
        .prepare(`UPDATE customer_quotes SET status = 'superseded' WHERE request_id = ? AND status = 'sent'`)
        .run(req.id);
      this.db.prepare(`UPDATE customer_quotes SET status = 'sent', sent_at = ? WHERE id = ?`).run(now(), quote.id);
      if (req.fulfilmentStatus === "sourcing") {
        this.setFulfilment(req, "quote_sent", "team", `Sent quote v${quote.version}`);
      } else {
        this.event({ requestId: req.id, track: "note", fromStatus: null, toStatus: null, actor: "team", note: `Sent revised quote v${quote.version}` });
      }
      const updated = this.mustGet(req.id);
      onQuoteSent(this.db, updated, quote);
      return updated;
    });
  }

  addSupplier(s: Omit<Supplier, "id">): Supplier {
    const id = uuid();
    this.db
      .prepare(`INSERT INTO suppliers (id, name, relationship, region, notes, is_demo) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(id, s.name, s.relationship, s.region, s.notes, s.isDemo ? 1 : 0);
    return { id, ...s };
  }

  addUnit(u: Omit<RideUnit, "id">): RideUnit {
    const id = uuid();
    this.db
      .prepare(
        `INSERT INTO ride_units (id, supplier_id, ride_slug, description, home_base, verification, is_demo)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, u.supplierId, u.rideSlug, u.description, u.homeBase, u.verification, u.isDemo ? 1 : 0);
    return { id, ...u };
  }

  addCandidate(requestId: string, supplierId: string, unitId: string | null, notes: string | null): RequestSupplier {
    return this.tx(() => {
      this.assertPaid(this.mustGet(requestId), "contact operators");
      if (!this.db.prepare(`SELECT 1 FROM suppliers WHERE id = ?`).get(supplierId)) {
        throw new DomainError("Supplier not found", "not_found");
      }
      if (unitId) {
        const unit = this.db.prepare(`SELECT supplier_id FROM ride_units WHERE id = ?`).get(unitId) as Row | undefined;
        if (!unit || unit.supplier_id !== supplierId) throw new DomainError("Unit does not belong to supplier", "invalid_state");
      }
      const id = uuid();
      try {
        this.db
          .prepare(
            `INSERT INTO request_suppliers (id, request_id, supplier_id, unit_id, stage, notes, updated_at)
             VALUES (?, ?, ?, ?, 'candidate', ?, ?)`,
          )
          .run(id, requestId, supplierId, unitId, notes, now());
      } catch {
        throw new DomainError("Supplier is already a candidate for this request", "conflict");
      }
      this.event({ requestId, track: "note", fromStatus: null, toStatus: null, actor: "team", note: "Added supplier candidate" });
      return this.listCandidates(requestId).find((c) => c.id === id)!;
    });
  }

  /** Commitment is NOT settable here — use commitSupplier, which enforces its preconditions. */
  setCandidateStage(candidateId: string, stage: Exclude<CandidateStage, "committed">): void {
    if ((stage as string) === "committed") throw new DomainError("Use commitSupplier", "forbidden");
    const owner = this.db.prepare(`SELECT request_id FROM request_suppliers WHERE id = ?`).get(candidateId) as Row | undefined;
    if (owner) this.assertPaid(this.mustGet(String(owner.request_id)), "contact operators");
    const res = this.db
      .prepare(`UPDATE request_suppliers SET stage = ?, updated_at = ? WHERE id = ? AND stage != 'committed'`)
      .run(stage, now(), candidateId);
    if (res.changes === 0) throw new DomainError("Candidate not found or already committed", "invalid_state");
  }

  recordSupplierQuote(q: Omit<SupplierQuote, "id" | "createdAt">): SupplierQuote {
    for (const k of ["supplierPriceCents", "transportCents", "crewCents", "otherCents"] as const) {
      const v = q[k];
      if (v !== null && (!Number.isInteger(v) || v < 0)) throw new DomainError(`${k} must be a non-negative integer or unknown`, "invalid_state");
    }
    return this.tx(() => {
      const cand = this.db
        .prepare(`SELECT * FROM request_suppliers WHERE request_id = ? AND supplier_id = ?`)
        .get(q.requestId, q.supplierId) as Row | undefined;
      if (!cand) throw new DomainError("Add the supplier as a candidate before recording a quote", "invalid_state");
      this.assertPaid(this.mustGet(q.requestId), "record an operator quote");
      const id = uuid();
      this.db
        .prepare(
          `INSERT INTO supplier_quotes (id, request_id, supplier_id, supplier_price_cents, transport_cents, crew_cents, other_cents, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(id, q.requestId, q.supplierId, q.supplierPriceCents, q.transportCents, q.crewCents, q.otherCents, q.notes, now());
      if (cand.stage !== "committed") {
        this.db.prepare(`UPDATE request_suppliers SET stage = 'quoted', updated_at = ? WHERE id = ?`).run(now(), String(cand.id));
      }
      this.event({ requestId: q.requestId, track: "note", fromStatus: null, toStatus: null, actor: "team", note: "Recorded supplier quote" });
      return this.listSupplierQuotes(q.requestId).find((x) => x.id === id)!;
    });
  }

  /**
   * Record that a supplier has committed specific fulfilment for this event.
   * Preconditions: customer accepted a quote; supplier is VERIFIED (a researched
   * prospect cannot be committed); the candidate has quoted; a unit is identified.
   */
  commitSupplier(requestId: string, candidateId: string, note: string | null): EventRequest {
    return this.tx(() => {
      const req = this.mustGet(requestId);
      const cand = this.listCandidates(requestId).find((c) => c.id === candidateId);
      if (!cand) throw new DomainError("Candidate not found", "not_found");
      const supplier = this.listSuppliers().find((s) => s.id === cand.supplierId)!;
      if (supplier.relationship !== "verified_supplier") {
        throw new DomainError("Only verified suppliers can be committed to an event", "invalid_state");
      }
      if (cand.stage !== "quoted") throw new DomainError("Supplier must have quoted for this event first", "invalid_state");
      if (!cand.unitId) throw new DomainError("Identify the physical ride unit before committing", "invalid_state");
      this.setFulfilment(req, "supplier_committed", "team", note ?? `Committed ${supplier.name}`);
      this.db.prepare(`UPDATE request_suppliers SET stage = 'committed', updated_at = ? WHERE id = ?`).run(now(), cand.id);
      this.db
        .prepare(`UPDATE event_requests SET assigned_supplier_id = ?, assigned_unit_id = ?, updated_at = ? WHERE id = ?`)
        .run(cand.supplierId, cand.unitId, now(), requestId);
      return this.mustGet(requestId);
    });
  }

  /** DEMO payment adapter: records a payment-track state. No money moves; no card data exists. */
  recordDemoPayment(requestId: string, to: PaymentStatus, note: string | null): EventRequest {
    return this.tx(() => {
      const req = this.mustGet(requestId);
      if (!canTransitionPayment(req.paymentStatus, to)) {
        throw new DomainError(`Cannot move payment from ${req.paymentStatus} to ${to}`, "invalid_state");
      }
      this.db.prepare(`UPDATE event_requests SET payment_status = ?, updated_at = ? WHERE id = ?`).run(to, now(), requestId);
      this.event({ requestId, track: "payment", fromStatus: req.paymentStatus, toStatus: to, actor: "team", note: `[DEMO] ${note ?? ""}`.trim() });
      const updated = this.mustGet(requestId);
      if (to === "funds_authorized") onPaymentAuthorized(this.db, updated);
      return updated;
    });
  }

  confirmBooking(requestId: string): EventRequest {
    return this.tx(() => {
      const req = this.mustGet(requestId);
      if (req.fulfilmentStatus !== "supplier_committed") {
        throw new DomainError("A supplier must be committed before confirming", "invalid_state");
      }
      if (!this.listQuotes(requestId).some((q) => q.status === "accepted")) {
        throw new DomainError("No accepted customer quote", "invalid_state");
      }
      if (req.paymentMode !== "demo" && !PAYMENT_POLICY.decided) {
        throw new DomainError("Payment policy has not been approved; real bookings cannot be confirmed", "forbidden");
      }
      if (req.paymentStatus !== PAYMENT_POLICY.demoConfirmationRequires) {
        throw new DomainError(
          `Confirmation requires payment status "${PAYMENT_POLICY.demoConfirmationRequires}" (currently "${req.paymentStatus}")`,
          "invalid_state",
        );
      }
      this.setFulfilment(req, "confirmed", "team", "Booking confirmed (demo payment mode)");
      return this.mustGet(requestId);
    });
  }
}
