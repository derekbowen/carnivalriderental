import crypto from "node:crypto";
import { requestTokenSecret } from "../config";

/**
 * Customer status links: /requests/{reference}?t={token}, token = HMAC(secret, requestId).
 * Deterministic, so an idempotent replay returns the same link without storing the token.
 * This is a capability link, not an account; customer accounts arrive with Sharetribe.
 */
export function customerToken(requestId: string): string {
  return crypto.createHmac("sha256", requestTokenSecret()).update(`status:${requestId}`).digest("base64url").slice(0, 32);
}

export function verifyCustomerToken(requestId: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const expected = Buffer.from(customerToken(requestId));
  const given = Buffer.from(token);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

export function statusPath(reference: string, requestId: string): string {
  return `/requests/${encodeURIComponent(reference)}?t=${customerToken(requestId)}`;
}
