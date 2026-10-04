// Environment-derived site settings. Read at call time so tests can vary them.

export const BRAND = {
  /** Working placeholder. The final name and domain are not approved. */
  name: "Book a Carnival",
  tagline: "Carnival ride rentals, sourced and coordinated for your event",
};

export function siteUrl(): string {
  const raw = process.env.SITE_URL || "http://127.0.0.1:3000";
  return raw.replace(/\/+$/, "");
}

/** Public indexing is opt-in and only ever "on" in an approved production. */
export function indexingEnabled(): boolean {
  return process.env.SITE_INDEXING === "on";
}

/** Whether development fixture records may render on public pages. */
export function fixturesVisible(): boolean {
  return process.env.SHOW_FIXTURES === "on";
}
