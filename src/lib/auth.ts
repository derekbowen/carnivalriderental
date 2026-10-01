/**
 * Edge-compatible HTTP Basic auth helpers (used by middleware AND re-checked in
 * internal route handlers as defence in depth). Development-grade: replace with
 * real staff accounts / SSO before any non-development deployment.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function parseBasic(header: string | null): { user: string; pass: string } | null {
  if (!header?.startsWith("Basic ")) return null;
  try {
    const decoded = atob(header.slice(6));
    const i = decoded.indexOf(":");
    return i < 0 ? null : { user: decoded.slice(0, i), pass: decoded.slice(i + 1) };
  } catch {
    return null;
  }
}

export type InternalAuthResult = "ok" | "unauthorized" | "disabled";

export function checkInternalAuth(authorization: string | null): InternalAuthResult {
  const user = process.env.INTERNAL_USER;
  const pass = process.env.INTERNAL_PASSWORD;
  if (!user || !pass || pass === "change-me") return "disabled";
  const creds = parseBasic(authorization);
  if (!creds) return "unauthorized";
  return safeEqual(creds.user, user) && safeEqual(creds.pass, pass) ? "ok" : "unauthorized";
}

export function checkSiteAccess(authorization: string | null): boolean {
  const pass = process.env.SITE_ACCESS_PASSWORD;
  if (!pass) return true;
  const creds = parseBasic(authorization);
  return !!creds && safeEqual(creds.pass, pass);
}
