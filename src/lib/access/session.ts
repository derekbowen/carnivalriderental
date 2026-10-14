/**
 * Customer access to a pass: no account, no password. A signed cookie proves the browser may open
 * one pass; a magic link (emailed) sets that cookie on any device. The cookie is bound to the pass
 * id, so one pass's session can't open another, and pass ids are random UUIDs (not enumerable).
 */
import crypto from "node:crypto";

export const PASS_COOKIE = "cr_pass";
const COOKIE_DAYS = 30;

export function sessionSecret(env: Record<string, string | undefined> = process.env): string {
  const s = env.ACCESS_SESSION_SECRET || env.REQUEST_TOKEN_SECRET;
  if (!s || s.length < 16) throw new Error("ACCESS_SESSION_SECRET (or REQUEST_TOKEN_SECRET) is missing or too short");
  return s;
}

const b64 = (b: Buffer) => b.toString("base64url");
const sign = (payload: string, secret: string) => b64(crypto.createHmac("sha256", secret).update(payload).digest());

/** Serialised cookie value: base64url(json).signature. Several passes may be held at once. */
export function encodeSession(passIds: string[], secret: string, now = Date.now()): string {
  const payload = b64(Buffer.from(JSON.stringify({ p: [...new Set(passIds)].slice(-10), exp: now + COOKIE_DAYS * 864e5 })));
  return `${payload}.${sign(payload, secret)}`;
}

export function decodeSession(value: string | undefined, secret: string, now = Date.now()): string[] {
  if (!value) return [];
  const i = value.lastIndexOf(".");
  if (i < 0) return [];
  const payload = value.slice(0, i);
  const sig = value.slice(i + 1);
  const expected = sign(payload, secret);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return [];
  try {
    const j = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { p?: unknown; exp?: unknown };
    if (typeof j.exp !== "number" || j.exp < now || !Array.isArray(j.p)) return [];
    return j.p.filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/.test(x));
  } catch {
    return [];
  }
}

export function cookieHeader(value: string, secure: boolean): string {
  return `${PASS_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_DAYS * 86400}${secure ? "; Secure" : ""}`;
}

/** Magic-link token: random, stored hashed, time-limited. */
export const newToken = () => crypto.randomBytes(32).toString("base64url");
export const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");
export const ipHash = (ip: string | null, secret: string) => (ip ? crypto.createHmac("sha256", secret).update(ip).digest("hex").slice(0, 32) : null);
