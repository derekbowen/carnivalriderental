import { ZodError } from "zod";
import { statusPath } from "./access";
import { createRequestSchema, todayIso } from "./schema";
import { DomainError, type RequestService } from "./service";

export interface HttpResult {
  status: number;
  body: Record<string, unknown>;
}

const STATUS_BY_CODE: Record<DomainError["code"], number> = {
  not_found: 404,
  conflict: 409,
  invalid_state: 422,
  forbidden: 403,
  payment_required: 402,
};

/** Map any error to a safe response. Internal details are logged server-side, never returned. */
export function errorResult(e: unknown): HttpResult {
  if (e instanceof ZodError) {
    return {
      status: 400,
      body: { ok: false, error: "validation_failed", issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
    };
  }
  if (e instanceof DomainError) return { status: STATUS_BY_CODE[e.code], body: { ok: false, error: e.code, message: e.message } };
  console.error("[requests] unexpected error", e instanceof Error ? e.message : "unknown");
  return { status: 500, body: { ok: false, error: "server_error", message: "We could not save your request. Nothing was submitted. Please try again." } };
}

/**
 * POST /api/requests. Success (201 new / 200 replay) is returned ONLY after the
 * write has committed; the response carries `persisted: true` and the status link.
 */
export function handleCreateRequest(body: unknown, svc: RequestService, now = new Date()): HttpResult {
  try {
    const input = createRequestSchema.parse(body);
    if (input.brief.eventDateStart < todayIso(now)) {
      return { status: 400, body: { ok: false, error: "validation_failed", issues: [{ path: "brief.eventDateStart", message: "Event date must be in the future" }] } };
    }
    const { request, created } = svc.createRequest(input);
    return {
      status: created ? 201 : 200,
      body: {
        ok: true,
        persisted: true,
        replayed: !created,
        reference: request.reference,
        statusUrl: statusPath(request.reference, request.id),
      },
    };
  } catch (e) {
    return errorResult(e);
  }
}
