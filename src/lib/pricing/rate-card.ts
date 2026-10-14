/**
 * Founder rate card (2026-10-04): "from" estimates per ride, per day, 4-hour rental.
 * Estimates only, never a final price: every display must carry ESTIMATE_DISCLAIMER.
 * Rows the founder has not confirmed stay null and render as "Request pricing".
 */
export type RateKey = "kiddie" | "family" | "ferris-wheel" | "giant-ferris-wheel" | "major" | "spectacular" | "coaster" | "other";

export const RATE_CARD: Record<RateKey, { fromUsd: number | null; confirmed: boolean; label: string }> = {
  kiddie: { fromUsd: 5000, confirmed: true, label: "Kiddie rides" },
  family: { fromUsd: 8000, confirmed: true, label: "Family rides" },
  "ferris-wheel": { fromUsd: 10000, confirmed: true, label: "Ferris wheels" },
  "giant-ferris-wheel": { fromUsd: 15000, confirmed: true, label: "Giant Ferris wheels" },
  // Proposed, awaiting founder confirmation — shown as "Request pricing" until confirmed.
  major: { fromUsd: null, confirmed: false, label: "Major rides" },
  spectacular: { fromUsd: null, confirmed: false, label: "Spectaculars" },
  coaster: { fromUsd: null, confirmed: false, label: "Roller coasters" },
  other: { fromUsd: null, confirmed: false, label: "Other attractions" },
};

export const RATE_UNIT = "per day (4-hour rental)";

export const ESTIMATE_DISCLAIMER =
  "Not the final booking price. Additional fees may apply for generator, transportation, special permits and fuel surcharge. Send your event details and the owner returns the total price.";

const GIANT = /\b(giant|grand|big|skyline|century|1[0-9]{2}\s*(ft|'|foot)|9[0-9]\s*(ft|'|foot))\b/i;
const WHEEL = /\b(ferris|wheel|gondola wheel|big eli)\b/i;

/** Which rate row a ride falls in, from its operator ride class and title. */
export function rateKeyFor(rideClass: string, title: string): RateKey {
  if (rideClass === "kiddie") return "kiddie"; // "Baby Ferris Wheel", "Little Wheel" are kiddie rides
  if (WHEEL.test(title) && !/\bwheel ?barrow\b/i.test(title)) return GIANT.test(title) ? "giant-ferris-wheel" : "ferris-wheel";
  if (rideClass === "family") return "family";
  if (rideClass === "major") return "major";
  if (rideClass === "spectacular") return "spectacular";
  if (rideClass === "coaster") return "coaster";
  return "other";
}

/** "Estimated from $10,000 per day (4-hour rental)" or null when the row isn't confirmed. */
export function estimateText(key: RateKey): string | null {
  const r = RATE_CARD[key];
  if (!r.confirmed || r.fromUsd === null) return null;
  return `Estimated from $${r.fromUsd.toLocaleString("en-US")} ${RATE_UNIT}`;
}
