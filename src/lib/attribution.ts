/**
 * Which campaign brought a visitor (founder request 2026-10-17: cost per sale for Google Ads before
 * raising the budget). The middleware keeps the latest utm_source / utm_medium / utm_campaign in a
 * first-party cookie for 30 days; a search started with it records one row against the event
 * request, so the funnel dashboard can show searches, sales and revenue by campaign.
 *
 * Campaign tags only: no personal data, no click ids (gclid, fbclid) and no free text. Writes are
 * best effort, like lifecycle events: a missing table never breaks a search or a checkout.
 * Edge-safe (the middleware imports it): no Node or database imports.
 */
export const ATTRIBUTION_COOKIE = "cr_src";
export const ATTRIBUTION_MAX_AGE = 30 * 86400;

export interface Attribution { source: string; medium: string | null; campaign: string | null }

const TAG = /^[a-z0-9._-]{1,60}$/;
const tag = (v: string | null | undefined): string | null => {
  const t = (v ?? "").trim().toLowerCase().replace(/[\s+]+/g, "-");
  return TAG.test(t) ? t : null;
};

/** The campaign tags of a landing URL, or null when there is no valid utm_source. */
export function attributionFromUrl(params: URLSearchParams): Attribution | null {
  const source = tag(params.get("utm_source"));
  return source ? { source, medium: tag(params.get("utm_medium")), campaign: tag(params.get("utm_campaign")) } : null;
}

export const encodeAttribution = (a: Attribution) => [a.source, a.medium ?? "", a.campaign ?? ""].join("|");

/** The cookie back into tags; anything malformed is ignored. */
export function decodeAttribution(value: string | null | undefined): Attribution | null {
  if (!value) return null;
  const [s, m, c, ...rest] = value.split("|");
  const source = tag(s);
  if (!source || rest.length) return null;
  return { source, medium: m ? tag(m) : null, campaign: c ? tag(c) : null };
}

type Query = { query: (sql: string, params?: unknown[]) => Promise<unknown[]> };

/** Records the campaign for an event request once (the first search's tags win). */
export async function recordAttribution(db: Query, eventRequestId: string, a: Attribution | null): Promise<boolean> {
  if (!a) return false;
  try {
    await db.query(
      `INSERT INTO access_attribution (event_request_id, source, medium, campaign, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (event_request_id) DO NOTHING`,
      [eventRequestId, a.source, a.medium, a.campaign, new Date().toISOString()],
    );
    return true;
  } catch {
    return false;
  }
}
