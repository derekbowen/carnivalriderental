// HTTP Basic auth for the internal team area. If credentials are not
// configured the area is closed — there is no default password.
import crypto from "node:crypto";

export type AuthResult = { ok: true; user: string } | { ok: false; status: 401 | 503 };

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function checkInternalAuth(header: string | null): AuthResult {
  const user = process.env.INTERNAL_USER;
  const pass = process.env.INTERNAL_PASSWORD;
  if (!user || !pass || pass.length < 12) return { ok: false, status: 503 };
  if (!header?.startsWith("Basic ")) return { ok: false, status: 401 };
  let decoded = "";
  try {
    decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  } catch {
    return { ok: false, status: 401 };
  }
  const i = decoded.indexOf(":");
  if (i < 0) return { ok: false, status: 401 };
  return safeEqual(decoded.slice(0, i), user) && safeEqual(decoded.slice(i + 1), pass)
    ? { ok: true, user }
    : { ok: false, status: 401 };
}
