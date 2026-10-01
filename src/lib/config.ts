/**
 * Runtime configuration. Read from process.env on each call so tests can vary it.
 * Defaults are deliberately conservative: not indexable, demo payments only.
 */
export type AppEnv = "development" | "preview" | "production";

export function appEnv(): AppEnv {
  const v = process.env.APP_ENV;
  return v === "production" || v === "preview" ? v : "development";
}

export function siteUrl(): string {
  return (process.env.SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
}

/** Public indexing requires BOTH production env and an explicit opt-in. */
export function publicIndexingEnabled(): boolean {
  return appEnv() === "production" && process.env.PUBLIC_INDEXING === "true";
}

/** Demo fixtures never load in production, regardless of the flag. */
export function demoContentAllowed(): boolean {
  if (appEnv() === "production") return false;
  return process.env.ALLOW_DEMO_CONTENT !== "false";
}

export function paymentsMode(): "demo" {
  // Only demo mode exists. Any other value is refused rather than silently accepted.
  const v = process.env.PAYMENTS_MODE || "demo";
  if (v !== "demo") {
    throw new Error(`PAYMENTS_MODE=${v} is not implemented. Only "demo" is available in this build.`);
  }
  return "demo";
}

export function requestTokenSecret(): string {
  const s = process.env.REQUEST_TOKEN_SECRET;
  if (!s || s.length < 16) {
    throw new Error("REQUEST_TOKEN_SECRET is missing or too short. Run `npm run setup`.");
  }
  return s;
}

export function databasePath(): string {
  return process.env.DATABASE_PATH || "data/dev.sqlite";
}

export const BRAND = {
  // Working placeholder name — not approved. Change here only.
  name: process.env.NEXT_PUBLIC_BRAND_NAME || "Book a Carnival",
  isPlaceholder: true,
  // Legal owner/operator and seller of record (confirmed by the founder 2026-10-01).
  legalEntity: "10000 Solutions LLC",
};
