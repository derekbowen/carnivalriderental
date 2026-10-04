// Request handling as plain functions over a DB, so the HTTP routes stay thin
// and tests can exercise the exact code path (including storage failures).
import type { DB } from "@/lib/db";
import { catalog } from "@/lib/catalog";
import { validateEventRequest } from "./input";
import { createEventRequest, acceptQuote, getRequest, RuleError } from "./repo";
import { findForCustomer, toPublicRequest } from "./public";
import { tokenFor } from "./token";
import { paths } from "@/lib/urls";

export type HandlerResult = { status: number; body: Record<string, unknown> };

const today = () => new Date().toISOString().slice(0, 10);

export function handleCreateRequest(db: DB, body: unknown): HandlerResult {
  const parsed = validateEventRequest(body, { today: today(), rideExists: (s) => Boolean(catalog.ride(s)) });
  if (!parsed.ok) return { status: 422, body: { error: "validation", fields: parsed.errors } };
  try {
    const { request, created } = createEventRequest(db, parsed.value);
    const token = tokenFor(request.id);
    // Success is reported only after the row is committed; the client shows
    // a confirmation only for this response, and the confirmation page itself
    // re-reads the stored request.
    return {
      status: created ? 201 : 200,
      body: {
        reference: request.reference,
        statusUrl: paths.requestStatus(request.reference, token),
        duplicate: !created,
      },
    };
  } catch (e) {
    if (e instanceof RuleError) return { status: e.httpStatus, body: { error: e.code, message: e.message } };
    console.error("[requests] create failed", e instanceof Error ? e.message : e);
    return {
      status: 503,
      body: { error: "not_saved", message: "Your request was not saved. Please try again." },
    };
  }
}

export function handleGetPublic(db: DB, reference: string, token: unknown): HandlerResult {
  const r = findForCustomer(db, reference, token);
  if (!r) return { status: 404, body: { error: "not_found" } };
  return { status: 200, body: { request: toPublicRequest(db, r) } };
}

export function handleAcceptQuote(db: DB, reference: string, body: unknown): HandlerResult {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const r = findForCustomer(db, reference, b.token);
  if (!r) return { status: 404, body: { error: "not_found" } };
  try {
    acceptQuote(db, r.id, String(b.quoteId ?? ""));
    // Respond from the stored state, not the row read before the change.
    return { status: 200, body: { request: toPublicRequest(db, getRequest(db, r.id)!) } };
  } catch (e) {
    if (e instanceof RuleError) return { status: e.httpStatus, body: { error: e.code, message: e.message } };
    console.error("[requests] accept failed", e instanceof Error ? e.message : e);
    return { status: 503, body: { error: "not_saved", message: "Your decision was not saved. Please try again." } };
  }
}
