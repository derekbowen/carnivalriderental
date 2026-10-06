/**
 * Request-side glue for Event Access: which engines this process may use, cookie session helpers
 * and a small in-memory rate limiter. Server only (imports the ledger and the Integration client).
 */
import { appEnv, siteUrl } from "../config";
import { activeProduct, type AccessProduct } from "./config";
import { operatorSource, type OperatorSource } from "./contacts";
import { accessDb, accessStorageMode, type AccessDb } from "./db";
import { cookieHeader, decodeSession, encodeSession, PASS_COOKIE, sessionSecret } from "./session";
import { stripeGateway, stripeMode, type StripeGateway } from "./stripe";

export interface Availability {
  enabled: boolean;
  reasons: string[];
  stripe: ReturnType<typeof stripeMode>["kind"];
  storage: ReturnType<typeof accessStorageMode>["kind"];
}

/** Whether this environment can sell Event Access at all (never silently unsafe). */
export function accessAvailability(env: Record<string, string | undefined> = process.env): Availability {
  const s = stripeMode(env);
  const d = accessStorageMode(env);
  const reasons: string[] = [];
  if (s.kind === "disabled") reasons.push(s.reason);
  if (d.kind === "disabled") reasons.push(d.reason);
  if (env.ACCESS_OPERATOR_SOURCE === "fixture" && (env.APP_ENV || "development") !== "development") reasons.push("fixture operator source outside development");
  if ((env.APP_ENV || "development") !== "development" && !(env.SHARETRIBE_INTEGRATION_CLIENT_ID && env.SHARETRIBE_INTEGRATION_CLIENT_SECRET) && env.ACCESS_OPERATOR_SOURCE !== "fixture") reasons.push("Integration API credentials missing (operator contacts unreadable)");
  try {
    sessionSecret(env);
  } catch (e) {
    reasons.push((e as Error).message);
  }
  return { enabled: reasons.length === 0, reasons, stripe: s.kind, storage: d.kind };
}

/**
 * The active product when the ledger is reachable, else null. Public pages must never 500 because
 * the ledger is down or misconfigured: they fall back to "opening soon" and log the cause.
 */
export async function activeProductOrNull(): Promise<AccessProduct | null> {
  if (!accessAvailability().enabled) return null;
  try {
    return await activeProduct(await accessDb());
  } catch (e) {
    console.error("[access] ledger unavailable:", (e as Error).message);
    return null;
  }
}

export interface AccessRuntime {
  db: AccessDb;
  gateway: StripeGateway;
  source: OperatorSource;
  siteUrl: string;
}

export async function accessRuntime(): Promise<AccessRuntime> {
  const a = accessAvailability();
  if (!a.enabled) throw new Error(`Event Access unavailable: ${a.reasons.join("; ")}`);
  const site = siteUrl();
  return { db: await accessDb(), gateway: stripeGateway(site), source: operatorSource(), siteUrl: site };
}

// ------------------------------------------------------------------------------ cookies
export function parseCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export const passIdsFromCookie = (cookieValue: string | undefined) => decodeSession(cookieValue, sessionSecret());

/** Set-Cookie value that adds one pass to whatever the browser already holds. */
export function grantPassCookie(existing: string | undefined, passId: string): string {
  const secret = sessionSecret();
  const ids = decodeSession(existing, secret);
  return cookieHeader(encodeSession([...ids, passId], secret), appEnv() !== "development");
}

export const passCookieName = PASS_COOKIE;

// ------------------------------------------------------------------------------ rate limit
const buckets = new Map<string, { n: number; reset: number }>();
/** Fixed-window limiter per key (process-local; enough to blunt abuse of the public endpoints). */
export function rateLimited(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    if (buckets.size > 10_000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    return false;
  }
  b.n++;
  return b.n > max;
}

/**
 * Public origin of the request (for Stripe success/cancel URLs). Prefers the forwarded host so the
 * app behind Vercel's proxy, a preview deployment or the e2e server all return to themselves.
 */
export function requestOrigin(req: Request): string {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || (host?.startsWith("localhost") || host?.startsWith("127.") ? "http" : "https");
  return host ? `${proto}://${host}` : siteUrl();
}

export function clientIp(req: Request): string | null {
  const h = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
  return h ? h.split(",")[0].trim() : null;
}

export const redirect = (location: string, headers: Record<string, string> = {}) => new Response(null, { status: 303, headers: { Location: location, "Cache-Control": "private, no-store", ...headers } });
