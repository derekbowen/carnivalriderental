/**
 * The site's main pages as the chat assistant may describe them (client-safe, no data access). The
 * model sees this list and may mention a page only by its exact path; the chat widget turns only
 * these paths into links, so a made-up URL in a reply stays plain text.
 */
import { BRAND } from "../config";
import { paths } from "../seo/routes";

export const SITE_GUIDE: readonly { path: string; label: string; use: string }[] = [
  { path: paths.search(), label: "Find a ride", use: "every listed ride, nearest first, filtered by ride type or state" },
  { path: paths.rides(), label: "Ride types", use: "browse rides by type (Ferris wheels, carousels, swing, kiddie and thrill rides)" },
  { path: paths.occasions(), label: "Events", use: "rides grouped by the kind of event" },
  { path: paths.directory(), label: "Locations", use: "every state and city page" },
  { path: paths.guide("how-to-rent-carnival-rides"), label: "How to rent", use: "buyer's guide: what to ask operators and how to compare quotes" },
  { path: paths.guide("ride-owner-vs-rental-broker"), label: "Ride owner vs. rental broker", use: "how direct and brokered rentals differ, and questions about ownership, crews, insurance and inspections" },
  { path: paths.connect(), label: "Connect with operators", use: "enter the event, see how many operators match for free, then buy Event Access" },
  { path: paths.concierge(), label: "Event form", use: "describe the event in a guided form" },
  { path: paths.passRecover(), label: "Find my pass", use: "a fresh link to a pass already bought" },
  { path: paths.accessPolicy(), label: "Event Access policy", use: "what Event Access includes, refunds, contacts that don't work" },
  { path: paths.operators(), label: "For ride operators", use: "operators list their rides free" },
  { path: paths.contact(), label: "Contact", use: "reach our team" },
];

const ALLOWED = new Set(SITE_GUIDE.map((p) => p.path));

/** The guide as one line for the model's instructions. */
export const siteGuideLine = () => SITE_GUIDE.map((p) => `${p.path} (${p.label}: ${p.use})`).join("; ");

/** The three steps, for a customer who doesn't know where to start. */
export const HOW_IT_WORKS = `It works in three steps: 1) tell me (or ${BRAND.domain}${paths.search()}) where and when your event is and which ride you want; 2) see how many independent operators match, free; 3) only if you want their direct contact details, buy Event Access and arrange the rental (price, dates, delivery) with them.`;

// "/pass/recover", "carnivalriderental.us/connect", "https://www.carnivalriderental.us/s"; a path
// must not follow a word or a dot ("and/or", "12/05").
const LINKABLE = new RegExp(`(?:https?://)?(?:www\\.)?${BRAND.domain.replace(/\./g, "\\.")}(?:/[a-z0-9/-]*)?|(?<![\\w./])/[a-z][a-z0-9/-]*`, "gi");

export type ChatSegment = { text: string; href?: string };

/** Splits a reply into text and links; only the guide's own pages (and the home page) become links. */
export function chatSegments(text: string): ChatSegment[] {
  const out: ChatSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(LINKABLE)) {
    const raw = m[0].replace(/[/-]+$/, "");
    const withHost = !raw.startsWith("/");
    const href = (withHost ? raw.replace(/^(?:https?:\/\/)?[^/]+/i, "") || "/" : raw).toLowerCase();
    // A bare "/" is never a link; the domain on its own links home.
    if (href === "/" ? !withHost : !ALLOWED.has(href)) continue;
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: raw, href });
    last = m.index + raw.length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
