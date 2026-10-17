/**
 * What Vercel Web Analytics may see of a URL (client-safe). Page views are counted without cookies;
 * this keeps per-customer identifiers and tokens out of them: the internal console is never counted,
 * pass, matches and request pages are counted by route, and every query parameter except the
 * campaign tags (utm_*) is dropped (magic-link tokens, purchase ids, search details).
 */
const ROUTES: [RegExp, string][] = [
  [/^\/pass\/(?!(?:recover|open|pending)$)[^/]+/, "/pass/[id]"],
  [/^\/connect\/[^/]+/, "/connect/[id]"],
  [/^\/requests\/[^/]+/, "/requests/[reference]"],
];
const CAMPAIGN = /^utm_(source|medium|campaign|term|content)$/;

export function analyticsUrl(raw: string): string | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (/^\/(internal|api)(\/|$)/.test(u.pathname)) return null;
  const path = ROUTES.reduce((p, [re, to]) => p.replace(re, to), u.pathname);
  const kept = new URLSearchParams();
  for (const [k, v] of u.searchParams) if (CAMPAIGN.test(k)) kept.append(k, v.slice(0, 100));
  const q = kept.toString();
  return `${u.origin}${path}${q ? `?${q}` : ""}`;
}
