/**
 * What the lead has and still needs (client-safe, no data access). The server uses it to decide
 * whether a search makes sense and what to tell the model; the chat UIs use it to show the right
 * next step instead of a form or button that can't work yet.
 */
import type { Lead } from "./schema";

export interface LeadState {
  hasLocation: boolean;
  hasDate: boolean;
  hasRide: boolean;
  hasEmail: boolean;
  /** A search needs somewhere to measure from or a ride to filter by; otherwise results are noise. */
  searchable: boolean;
  /** "Email me these options" (the form supplies the email). */
  missingForEmail: string[];
  /** Request Availability, See access offer: email is needed too. */
  missingForAvailability: string[];
}

export function leadState(d: Lead): LeadState {
  const hasLocation = !!(d.city && d.state), hasDate = !!d.eventDate, hasRide = d.requestedRides.length > 0, hasEmail = !!d.email;
  const missingForEmail = [...(hasDate ? [] : ["event date"]), ...(hasLocation ? [] : ["city and state"])];
  return { hasLocation, hasDate, hasRide, hasEmail, searchable: hasLocation || hasRide, missingForEmail, missingForAvailability: [...missingForEmail, ...(hasEmail ? [] : ["email"])] };
}

/** "event date", "event date and email", "event date, city and state, and email". */
export function listOf(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/** One sentence the chat shows (and the model repeats) when an action needs details we don't have. */
export const needDetails = (missing: string[]) => `To do that I need your ${listOf(missing)}. Tell me in the chat, for example "June 15 2030 in Columbus, OH".`;

/** Added once, the first time results are shown before any email (the application's offer, not the model's). */
export const emailOfferLine = (missing: string[]) =>
  missing.length
    ? `Want these options by email? Add your email under the results and I'll send them as soon as I have your ${listOf(missing)}.`
    : "Want these options by email? Add your email under the results and I'll send them once.";
