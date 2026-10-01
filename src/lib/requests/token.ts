// Customer access to a request's status page is a bearer link:
//   /requests/<reference>?t=<token>
// The token is an HMAC of the request id, so it is never stored, and a retried
// submission (same idempotency key) can return the same link again.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

let devSecret: string | null = null;

function secret(): string {
  const env = process.env.REQUEST_TOKEN_SECRET;
  if (env && env.length >= 32) return env;
  if (process.env.NODE_ENV === "production") {
    throw new Error("REQUEST_TOKEN_SECRET (32+ chars) is required in production.");
  }
  // Development: a random secret kept next to the dev database (gitignored).
  if (!devSecret) {
    const file = path.resolve(".data/request-token-secret");
    try {
      devSecret = fs.readFileSync(file, "utf8").trim();
    } catch {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      devSecret = crypto.randomBytes(32).toString("base64url");
      fs.writeFileSync(file, devSecret, { mode: 0o600 });
    }
  }
  return devSecret;
}

export function tokenFor(requestId: string): string {
  return crypto.createHmac("sha256", secret()).update(`request:${requestId}`).digest("base64url");
}

export function tokenMatches(requestId: string, token: unknown): boolean {
  if (typeof token !== "string" || token.length > 100) return false;
  const expected = Buffer.from(tokenFor(requestId));
  const given = Buffer.from(token);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}
