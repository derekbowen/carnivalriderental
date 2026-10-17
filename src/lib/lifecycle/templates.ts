/**
 * Lifecycle email templates (founder decision 2026-10-14): five approved templates, rendered by the
 * app from ledger facts. AI never writes an email; at most it picks among templates that are already
 * eligible and supplies one short intro line, which is validated before use (ai.ts). Every number,
 * place, date and price below comes from the variables, which come from the ledger and the product
 * rows, never from the model.
 *
 * Copy rules (CLAUDE.md, PROJECT_BRIEF.md): operators are anonymous until unlocked; no availability,
 * booking, price-of-rental or guarantee claims; Event Access is a one-time fee for contact access and
 * the rental is arranged directly with the operator.
 */
import { BRAND } from "../config";
import { contactsPhrase } from "../access/copy";

export type LifecycleTemplate = "saved_search" | "search_abandonment_1h" | "search_abandonment_24h" | "checkout_abandonment_1h" | "purchased_no_unlock_2h";

/** Commercial templates are marketing under CAN-SPAM: they need an approved campaign, unsubscribe and a postal address. */
export const TEMPLATE_KIND: Record<LifecycleTemplate, "transactional" | "commercial"> = {
  saved_search: "transactional",
  search_abandonment_1h: "commercial",
  search_abandonment_24h: "commercial",
  checkout_abandonment_1h: "commercial",
  purchased_no_unlock_2h: "transactional",
};
/** The campaign the commercial templates belong to (EMAIL_APPROVED_CAMPAIGNS). */
export const LIFECYCLE_CAMPAIGN = "lifecycle-v1";
export const LIFECYCLE_TEMPLATES = Object.keys(TEMPLATE_KIND) as LifecycleTemplate[];

export interface LifecycleListing {
  title: string;
  /** "Kiddie train", or null when the ride isn't classified. */
  rideLabel: string | null;
  miles: number;
  thumb: string | null;
  /** "Operator A": operators stay anonymous until unlocked. */
  operatorLabel: string;
}

export interface LifecycleVars {
  city: string;
  state: string;
  /** YYYY-MM-DD */
  eventDate: string;
  /** "school carnival or fundraiser"; null → "event". */
  eventType: string | null;
  /** Singular, sentence-ready: "kiddie train", "Ferris wheel", "carnival ride". */
  ride: string;
  ridePlural: string;
  /** Set when this request is an alternative the customer picked: what they first asked for. */
  alternativeTo: string | null;
  operators: number;
  nearestMiles: number | null;
  radiusMiles: number;
  listings: LifecycleListing[];
  /** search_abandonment_24h: other rides listed near the event (public snapshot counts). */
  nearby: { label: string; operators: number }[];
  product: { name: string; price: string; unlockLimit: number; validityDays: number } | null;
  /** purchased_no_unlock_2h */
  pass: { unlockLimit: number; expiresOn: string } | null;
  ctaUrl: string;
  unsubscribeUrl: string | null;
  postalAddress: string | null;
  /** One validated personal line (ai.ts) or null for the default copy. */
  intro: string | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const ops = (n: number) => `${n} operator${n === 1 ? "" : "s"}`;
const article = (noun: string) => (/^[aeiou]/i.test(noun) ? "an" : "a");

export function longDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? isoDate : d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

type Block = { kind: "p"; text: string } | { kind: "cta"; label: string; href: string } | { kind: "facts"; rows: [string, string][] } | { kind: "listings"; items: LifecycleListing[] } | { kind: "small"; text: string };

function render(subject: string, blocks: Block[], v: LifecycleVars, why: string, commercial: boolean): RenderedEmail {
  const html: string[] = [];
  const text: string[] = [];
  for (const b of blocks) {
    if (b.kind === "p" || b.kind === "small") {
      html.push(b.kind === "p" ? `<p style="margin:0 0 16px">${esc(b.text)}</p>` : `<p style="margin:0 0 16px;font-size:13px;color:#555">${esc(b.text)}</p>`);
      text.push(b.text);
    } else if (b.kind === "cta") {
      html.push(`<p style="margin:24px 0"><a href="${esc(b.href)}" style="display:inline-block;background:#f5b400;color:#0b1b3f;font-weight:700;padding:12px 20px;border-radius:8px;text-decoration:none">${esc(b.label)}</a></p>`);
      text.push(`${b.label}: ${b.href}`);
    } else if (b.kind === "facts") {
      html.push(`<table role="presentation" style="border-collapse:collapse;margin:0 0 16px">${b.rows.map(([k, val]) => `<tr><td style="padding:2px 16px 2px 0;color:#666;vertical-align:top">${esc(k)}</td><td style="padding:2px 0">${esc(val)}</td></tr>`).join("")}</table>`);
      text.push(b.rows.map(([k, val]) => `${k}: ${val}`).join("\n"));
    } else if (b.kind === "listings" && b.items.length) {
      html.push(
        `<table role="presentation" style="border-collapse:collapse;width:100%;margin:0 0 16px">${b.items
          .map(
            (l) =>
              `<tr><td style="padding:8px 12px 8px 0;width:72px;vertical-align:top">${l.thumb ? `<img src="${esc(l.thumb)}" width="64" height="64" alt="" style="border-radius:6px;display:block;object-fit:cover">` : ""}</td><td style="padding:8px 0;vertical-align:top"><strong>${esc(l.title)}</strong><br><span style="color:#555;font-size:13px">${esc([l.rideLabel, `about ${l.miles} miles from your event`, l.operatorLabel].filter(Boolean).join(" · "))}</span></td></tr>`,
          )
          .join("")}</table>`,
      );
      text.push(b.items.map((l) => `- ${l.title} (${[l.rideLabel, `about ${l.miles} miles away`, l.operatorLabel].filter(Boolean).join(", ")})`).join("\n"));
    }
  }
  const footer = [
    why,
    `${BRAND.name} is owned and operated by ${BRAND.legalEntity}.${commercial && v.postalAddress ? ` ${v.postalAddress}` : ""}`,
    "Operators are independent businesses. Pricing, availability and the rental itself are agreed directly with them.",
  ];
  const unsub = v.unsubscribeUrl ? `<a href="${esc(v.unsubscribeUrl)}" style="color:#555">Unsubscribe from these emails</a>` : "";
  return {
    subject,
    html: `<!doctype html><html><body style="margin:0;background:#f4f5f8"><div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px;background:#ffffff"><p style="margin:0 0 20px;font-weight:800;color:#0b1b3f">${esc(BRAND.name)}</p>${html.join("")}<hr style="border:none;border-top:1px solid #ddd;margin:24px 0"><p style="font-size:12px;color:#666;margin:0">${footer.map(esc).join("<br>")}${unsub ? `<br>${unsub}` : ""}</p></div></body></html>`,
    text: [...text, "--", ...footer, ...(v.unsubscribeUrl ? [`Unsubscribe: ${v.unsubscribeUrl}`] : [])].join("\n\n"),
  };
}

const eventPhrase = (v: LifecycleVars) => (v.eventType ? `your ${v.eventType}` : "your event");
const altNote = (v: LifecycleVars) => (v.alternativeTo ? ` (an alternative to the ${v.alternativeTo} you first asked for)` : "");
const accessLine = (v: LifecycleVars) =>
  v.product ? `${v.product.name} is ${v.product.price}, one time. It includes direct contact details for ${contactsPhrase(v.product.unlockLimit, v.operators)} for ${v.product.validityDays} days. The rental itself is arranged and paid directly with the operator.` : null;

/** Default intro lines; ai.ts may replace one with a validated personal line. */
export function defaultIntro(t: LifecycleTemplate, v: LifecycleVars): string {
  switch (t) {
    case "saved_search":
      return `Here are the rides you were looking at for ${eventPhrase(v)} in ${v.city}.`;
    case "search_abandonment_1h":
      return `You were looking at ${v.ride} options for your event in ${v.city} earlier.`;
    case "search_abandonment_24h":
      return `If you're still working on rides for ${longDate(v.eventDate)}, your search is saved.`;
    case "checkout_abandonment_1h":
      return `You found ${ops(v.operators)} with ${v.ridePlural} for your event in ${v.city}. Your search is saved if you'd like to continue.`;
    case "purchased_no_unlock_2h":
      return `Your ${v.product?.name ?? "Event Access"} is active, but you haven't opened any operator contacts yet.`;
  }
}

export function renderLifecycle(t: LifecycleTemplate, v: LifecycleVars): RenderedEmail {
  const intro = v.intro ?? defaultIntro(t, v);
  const commercial = TEMPLATE_KIND[t] === "commercial";
  const nearest = v.nearestMiles !== null ? `, the nearest about ${v.nearestMiles} miles away` : "";
  const facts: [string, string][] = [
    ["Ride", `${v.ride.charAt(0).toUpperCase()}${v.ride.slice(1)}${altNote(v)}`],
    ["Where", `${v.city}, ${v.state}`],
    ["Date", longDate(v.eventDate)],
    ...(v.eventType ? ([["Event", v.eventType.charAt(0).toUpperCase() + v.eventType.slice(1)]] as [string, string][]) : []),
  ];
  const why = commercial ? "You're receiving this because you searched for carnival rides on our site with this email address." : "You're receiving this because of your request on our site.";
  switch (t) {
    case "saved_search":
      return render(
        `Your carnival ride options for ${v.city}`,
        [
          { kind: "p", text: intro },
          { kind: "facts", rows: facts },
          { kind: "p", text: `We found ${ops(v.operators)} with matching equipment within ${v.radiusMiles} miles${nearest}. Each company counts once, however many rides it lists. We don't know their calendars, so this is not availability.` },
          { kind: "listings", items: v.listings },
          { kind: "cta", label: "Continue your search", href: v.ctaUrl },
          { kind: "small", text: "Your search is saved: the button opens it again, no account needed." },
        ],
        v,
        "You're receiving this because you asked us to email these results.",
        false,
      );
    case "search_abandonment_1h":
      return render(
        `Still looking for ${article(v.ride)} ${v.ride} in ${v.city}?`,
        [
          { kind: "p", text: intro },
          { kind: "p", text: `We found ${ops(v.operators)} with matching ${v.ridePlural}${nearest}.` },
          { kind: "listings", items: v.listings },
          { kind: "cta", label: "Continue where you left off", href: v.ctaUrl },
        ],
        v,
        why,
        commercial,
      );
    case "search_abandonment_24h": {
      const blocks: Block[] = [
        { kind: "p", text: intro },
        { kind: "facts", rows: facts },
        { kind: "p", text: `${v.ride.charAt(0).toUpperCase()}${v.ride.slice(1)}: ${ops(v.operators)} near ${v.city}${nearest}.` },
      ];
      if (v.nearby.length) blocks.push({ kind: "p", text: `Also listed near ${v.city}: ${v.nearby.map((n) => `${n.label} (${ops(n.operators)})`).join(", ")}.` });
      const access = accessLine(v);
      if (access) blocks.push({ kind: "p", text: access });
      blocks.push({ kind: "cta", label: "Open your saved search", href: v.ctaUrl });
      return render(`Still planning your ${v.city} event?`, blocks, v, why, commercial);
    }
    case "checkout_abandonment_1h": {
      const blocks: Block[] = [{ kind: "p", text: intro }, { kind: "facts", rows: facts }];
      const access = accessLine(v);
      if (access) blocks.push({ kind: "p", text: access });
      blocks.push({ kind: "small", text: "Nothing was charged for the checkout you started." });
      blocks.push({ kind: "cta", label: "Continue Event Access", href: v.ctaUrl });
      return render("Your operator matches are still available", blocks, v, why, commercial);
    }
    case "purchased_no_unlock_2h":
      return render(
        "Your operator contacts are ready",
        [
          { kind: "p", text: intro },
          { kind: "p", text: `Your pass covers ${contactsPhrase(v.pass?.unlockLimit ?? v.product?.unlockLimit ?? 0, v.operators)} for your event in ${v.city}${v.pass ? `, until ${v.pass.expiresOn}` : ""}. Each unlock shows the company name and the phone, email or website the operator lists.` },
          { kind: "cta", label: "View my matches", href: v.ctaUrl },
          { kind: "small", text: "The button signs you in to your pass on this device. Keep this email: it works for 14 days." },
        ],
        v,
        "You're receiving this because you bought Event Access on our site.",
        false,
      );
  }
}
