// The ONLY shape of a request that customers see. Built field by field from
// an allow-list: supplier records, supplier quotes, costs, margins, internal
// next actions and history notes are never included.
import type { DB } from "@/lib/db";
import { customerQuotes, getRequestByReference, requestHistory, type EventRequestRow } from "./repo";
import { FULFILLMENT_LABEL, PAYMENT_LABEL, type FulfillmentStatus, type PaymentStatus } from "./status";
import { tokenMatches } from "./token";

export type PublicQuote = {
  id: string;
  version: number;
  priceCents: number;
  scope: string;
  status: "sent" | "accepted";
  sentAt: string | null;
  acceptedAt: string | null;
};

export type PublicRequest = {
  reference: string;
  createdAt: string;
  fulfillment: { status: FulfillmentStatus; label: string };
  payment: { status: PaymentStatus; label: string };
  brief: {
    rideSlug: string | null;
    rideFlexibility: string;
    dateStart: string;
    dateEnd: string | null;
    dateFlexibility: string;
    city: string;
    state: string;
    venue: string | null;
    operatingHours: string | null;
    eventType: string;
    expectedAttendance: string | null;
    budget: string | null;
    siteAccess: string;
    availableSpace: string;
    power: string;
    notes: string | null;
    contactName: string;
    contactEmail: string;
  };
  /** The open or accepted quote only. Drafts, superseded and withdrawn are hidden. */
  quote: PublicQuote | null;
  /** Status changes with timestamps; internal notes are not included. */
  timeline: { status: FulfillmentStatus; at: string }[];
};

export function toPublicRequest(db: DB, r: EventRequestRow): PublicRequest {
  const q = customerQuotes(db, r.id).find((x) => x.status === "sent" || x.status === "accepted");
  return {
    reference: r.reference,
    createdAt: r.created_at,
    fulfillment: { status: r.fulfillment_status, label: FULFILLMENT_LABEL[r.fulfillment_status] },
    payment: { status: r.payment_status, label: PAYMENT_LABEL[r.payment_status] },
    brief: {
      rideSlug: r.ride_slug,
      rideFlexibility: r.ride_flexibility,
      dateStart: r.date_start,
      dateEnd: r.date_end,
      dateFlexibility: r.date_flexibility,
      city: r.city,
      state: r.state,
      venue: r.venue,
      operatingHours: r.operating_hours,
      eventType: r.event_type,
      expectedAttendance: r.expected_attendance,
      budget: r.budget,
      siteAccess: r.site_access,
      availableSpace: r.available_space,
      power: r.power,
      notes: r.notes,
      contactName: r.contact_name,
      contactEmail: r.contact_email,
    },
    quote: q
      ? {
          id: q.id,
          version: q.version,
          priceCents: q.price_cents,
          scope: q.scope,
          status: q.status as "sent" | "accepted",
          sentAt: q.sent_at,
          acceptedAt: q.accepted_at,
        }
      : null,
    timeline: requestHistory(db, r.id)
      .filter((h) => h.kind === "status" && h.to_status)
      .map((h) => ({ status: h.to_status as FulfillmentStatus, at: h.created_at })),
  };
}

/** Look up a request for a customer holding the status link. */
export function findForCustomer(db: DB, reference: unknown, token: unknown): EventRequestRow | undefined {
  if (typeof reference !== "string" || !/^BAC-[A-Z0-9]{6}$/.test(reference)) return undefined;
  const r = getRequestByReference(db, reference);
  return r && tokenMatches(r.id, token) ? r : undefined;
}
