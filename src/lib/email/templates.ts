/**
 * Email templates. Plain, honest wording that follows the site rules:
 * pay first, prices are estimates, a request is not a booking, nothing is "confirmed" until
 * confirmBooking succeeds, payments are demo-only in this build.
 */
import { BRAND } from "../config";
import { PRICE_COPY } from "../pricing/policy";

export interface Rendered {
  subject: string;
  html: string;
  text: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(paragraphs: string[], footer: string[]): { html: string; text: string } {
  const html = `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px">${paragraphs
    .map((p) => `<p>${p}</p>`)
    .join("")}<hr style="border:none;border-top:1px solid #ddd;margin:24px 0"><p style="font-size:12px;color:#666">${footer.join("<br>")}</p></body></html>`;
  const strip = (s: string) => s.replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g, "$2: $1").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  const text = [...paragraphs.map(strip), "--", ...footer.map(strip)].join("\n\n");
  return { html, text };
}

const link = (href: string, label: string) => `<a href="${esc(href)}">${esc(label)}</a>`;
const DEMO = "Payments on this site are in test mode: no real money moves.";

export function requestReceived(p: { name: string; reference: string; statusUrl: string }): Rendered {
  return {
    subject: `We received your request ${p.reference}`,
    ...layout(
      [
        `Hi ${esc(p.name)},`,
        `Thanks — we received your carnival ride request <strong>${esc(p.reference)}</strong>.`,
        `What happens next: you pay to start sourcing. We do not contact operators or prepare a quote until payment is made. ${esc(PRICE_COPY.notFinal)}`,
        `This is a request, not a booking. Nothing is reserved until we confirm a booking with you.`,
        `${link(p.statusUrl, "View your request")}`,
      ],
      [`${esc(BRAND.name)}`, DEMO],
    ),
  };
}

export function paymentReceived(p: { name: string; reference: string; statusUrl: string }): Rendered {
  return {
    subject: `Payment received for ${p.reference} — we're sourcing your rides`,
    ...layout(
      [
        `Hi ${esc(p.name)},`,
        `Your payment for request <strong>${esc(p.reference)}</strong> has been recorded, so we've started sourcing operators for your event.`,
        `We'll send you a written quote with the final scope. This is not yet a confirmed booking.`,
        `${link(p.statusUrl, "View your request")}`,
      ],
      [`${esc(BRAND.name)}`, DEMO],
    ),
  };
}

export function quoteReady(p: { name: string; reference: string; statusUrl: string; version: number }): Rendered {
  return {
    subject: `Your quote for ${p.reference} is ready`,
    ...layout(
      [
        `Hi ${esc(p.name)},`,
        `Quote v${p.version} for request <strong>${esc(p.reference)}</strong> is ready to review.`,
        `Accepting the quote does not by itself confirm a booking; we confirm once the operator has committed.`,
        `${link(p.statusUrl, "Review your quote")}`,
      ],
      [`${esc(BRAND.name)}`, DEMO],
    ),
  };
}

export function adminPaidAlert(p: { reference: string; customer: string; city: string; state: string; date: string; consoleUrl: string }): Rendered {
  return {
    subject: `[Paid] ${p.reference} — ${p.city}, ${p.state} on ${p.date}`,
    ...layout(
      [`Request <strong>${esc(p.reference)}</strong> from ${esc(p.customer)} is paid. Sourcing may start.`, `${link(p.consoleUrl, "Open in the request console")}`],
      [`${esc(BRAND.name)} internal alert`, DEMO],
    ),
  };
}

/**
 * Operator claim invitation (outreach). Factual only: no fee, feature or traffic claims — those are
 * not approved (src/lib/operators/program.ts copyApproved=false). Offers claim, correction and removal.
 */
export function claimInvite(p: { companyName: string; rideCount: number; unsubscribeUrl: string; postalAddress: string; replyTo: string }): Rendered {
  const rides = p.rideCount > 0 ? `${p.rideCount} ride${p.rideCount === 1 ? "" : "s"} from your public website` : "your company details";
  return {
    subject: `${p.companyName}: we've prepared an unclaimed profile for you`,
    ...layout(
      [
        `Hello ${esc(p.companyName)} team,`,
        `We're building ${esc(BRAND.name)}, a place for event organizers to find carnival rides. We've prepared an <strong>unclaimed, unpublished</strong> profile for ${esc(p.companyName)} with ${esc(rides)}. It is not visible to the public.`,
        `If you'd like to claim it, correct anything, or have it removed, just reply to this email (${esc(p.replyTo)}).`,
        `If you'd rather not hear from us, ${link(p.unsubscribeUrl, "unsubscribe here")} and we won't email you again.`,
      ],
      [
        `You're receiving this because ${esc(p.companyName)} is publicly listed as a carnival ride operator.`,
        `${esc(BRAND.name)} · ${esc(p.postalAddress)}`,
        link(p.unsubscribeUrl, "Unsubscribe"),
      ],
    ),
  };
}
