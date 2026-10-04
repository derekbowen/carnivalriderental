/**
 * Transactional email events for the request flow. Called from RequestService inside its write
 * transaction, so the email row commits (or rolls back) with the state change that caused it.
 * Sending happens later in dispatchOutbox; in EMAIL_MODE=test everything goes to the test inbox.
 */
import { siteUrl } from "../config";
import type { Db } from "../requests/db";
import { statusPath } from "../requests/access";
import type { EventRequest } from "../requests/types";
import { emailConfig } from "./config";
import { enqueue } from "./outbox";
import { adminPaidAlert, paymentReceived, quoteReady, requestReceived } from "./templates";

const statusUrl = (r: EventRequest) => `${siteUrl()}${statusPath(r.reference, r.id)}`;

export function onRequestCreated(db: Db, r: EventRequest): void {
  enqueue(db, {
    kind: "transactional",
    template: "request_received",
    dedupeKey: `request_received:${r.id}`,
    to: r.brief.contact.email,
    requestId: r.id,
    content: requestReceived({ name: r.brief.contact.name, reference: r.reference, statusUrl: statusUrl(r) }),
  });
}

export function onPaymentAuthorized(db: Db, r: EventRequest): void {
  enqueue(db, {
    kind: "transactional",
    template: "payment_received",
    dedupeKey: `payment_received:${r.id}`,
    to: r.brief.contact.email,
    requestId: r.id,
    content: paymentReceived({ name: r.brief.contact.name, reference: r.reference, statusUrl: statusUrl(r) }),
  });
  const admin = emailConfig().adminRecipient;
  if (admin) {
    enqueue(db, {
      kind: "transactional",
      template: "admin_paid_alert",
      dedupeKey: `admin_paid_alert:${r.id}`,
      to: admin,
      requestId: r.id,
      content: adminPaidAlert({
        reference: r.reference,
        customer: r.brief.contact.organization ?? r.brief.contact.name,
        city: r.brief.city,
        state: r.brief.state,
        date: r.brief.eventDateStart,
        consoleUrl: `${siteUrl()}/internal/requests/${r.id}`,
      }),
    });
  }
}

export function onQuoteSent(db: Db, r: EventRequest, quote: { id: string; version: number }): void {
  enqueue(db, {
    kind: "transactional",
    template: "quote_ready",
    dedupeKey: `quote_ready:${quote.id}`,
    to: r.brief.contact.email,
    requestId: r.id,
    content: quoteReady({ name: r.brief.contact.name, reference: r.reference, statusUrl: statusUrl(r), version: quote.version }),
  });
}
