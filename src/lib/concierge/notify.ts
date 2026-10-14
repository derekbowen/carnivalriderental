/**
 * Team notification for a chat availability request: the customer's own event details, sent to
 * support@ like a manual search, so a request never sits unseen in the ledger. No operator data.
 */
import { BRAND } from "../config";
import { rideTypeFor } from "../inventory";
import type { Lead } from "./schema";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function availabilityRequestEmail(p: { requestId: string; details: Lead; listing: { id: string; title: string } | null }): { subject: string; html: string; text: string } {
  const d = p.details;
  const rides = d.requestedRides.map((r) => `${r.quantity ?? "?"} × ${rideTypeFor(r.rideType)?.name ?? r.rideType}`).join(", ");
  const rows: [string, string][] = [
    ["Ride", p.listing ? `${p.listing.title} (listing ${p.listing.id})` : rides || "not chosen"],
    ...(p.listing && rides ? ([["Also wants", rides]] as [string, string][]) : []),
    ["Event date", d.eventDate ?? "not given"],
    ["Where", [d.city, d.state, d.zip].filter(Boolean).join(", ") || "not given"],
    ["Event type", d.eventType ?? "not given"],
    ["Attendance", d.attendance === null ? "not given" : d.attendance.toLocaleString("en-US")],
    ["Budget", d.budgetUsd === null ? "not given" : `$${d.budgetUsd.toLocaleString("en-US")}`],
    ["Setup", d.setupConstraints ?? "not given"],
    ["Customer", [d.contactName, d.email, d.phone].filter(Boolean).join(" · ") || "not given"],
    ["Request id", p.requestId],
  ];
  const where = [d.city, d.state].filter(Boolean).join(", ");
  const subject = `Availability request: ${p.listing?.title ?? (rides || "any ride")}${where ? ` near ${where}` : ""}${d.eventDate ? ` (${d.eventDate})` : ""}`;
  const intro = `A customer asked about availability in the ${BRAND.name} chat. Nothing has been sent to any operator. Reply to the customer${d.email ? ` at ${d.email}` : ""}.`;
  const text = [intro, ...rows.map(([k, v]) => `${k}: ${v}`)].join("\n");
  const html = `<p>${esc(intro)}</p><table>${rows.map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#666;vertical-align:top">${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>`;
  return { subject, html, text };
}
