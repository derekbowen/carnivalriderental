/**
 * The visitor's approximate city and state from Vercel's IP geolocation headers, to prefill the
 * Connect form on phones (founder 2026-10-18: fewer taps). US only; the state only when it is a real
 * US state, the city only when our geocoder places it, so a guess never causes a "couldn't place
 * that city" error. Read per request and never stored unless the visitor submits the form.
 */
import { US_STATES } from "../taxonomy";
import { geocode } from "./matching";

export interface VisitorPlace {
  city: string | null;
  state: string | null;
}

const NOWHERE: VisitorPlace = { city: null, state: null };

export function visitorPlace(h: { get(name: string): string | null }): VisitorPlace {
  if (h.get("x-vercel-ip-country") !== "US") return NOWHERE;
  const state = (h.get("x-vercel-ip-country-region") ?? "").trim().toUpperCase();
  if (!US_STATES.some((s) => s.abbr.toUpperCase() === state)) return NOWHERE;
  let city: string | null;
  try {
    city = decodeURIComponent(h.get("x-vercel-ip-city") ?? "").trim() || null;
  } catch {
    city = null;
  }
  return { state, city: city && geocode(city, state)?.resolved === "city" ? city : null };
}
