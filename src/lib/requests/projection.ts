import type { CustomerQuote, EventBrief, EventRequest, FulfilmentStatus, PaymentStatus, StatusEvent } from "./types";

/**
 * The ONLY shape of request data that leaves the server for customers.
 * Built by whitelisting fields — supplier identities, supplier quotes, costs,
 * margins, internal notes and draft quotes are never included.
 */
export interface PublicRequestView {
  reference: string;
  createdAt: string;
  brief: EventBrief;
  fulfilmentStatus: FulfilmentStatus;
  paymentStatus: PaymentStatus;
  paymentMode: "demo";
  quotes: { id: string; version: number; amountCents: number; scope: string; status: "sent" | "accepted" | "superseded" | "withdrawn"; sentAt: string | null; acceptedAt: string | null }[];
  history: { track: "fulfilment" | "payment"; toStatus: string; createdAt: string }[];
}

export function toPublicView(req: EventRequest, quotes: CustomerQuote[], events: StatusEvent[]): PublicRequestView {
  return {
    reference: req.reference,
    createdAt: req.createdAt,
    brief: req.brief,
    fulfilmentStatus: req.fulfilmentStatus,
    paymentStatus: req.paymentStatus,
    paymentMode: req.paymentMode,
    quotes: quotes
      .filter((q): q is CustomerQuote & { status: Exclude<CustomerQuote["status"], "draft"> } => q.status !== "draft")
      .map((q) => ({
        id: q.id,
        version: q.version,
        amountCents: q.amountCents,
        scope: q.scope,
        status: q.status,
        sentAt: q.sentAt,
        acceptedAt: q.acceptedAt,
      })),
    history: events
      .filter((e): e is StatusEvent & { track: "fulfilment" | "payment"; toStatus: string } => e.track !== "note" && !!e.toStatus)
      .map((e) => ({ track: e.track, toStatus: e.toStatus, createdAt: e.createdAt })),
  };
}
