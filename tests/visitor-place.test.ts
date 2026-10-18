/**
 * Connect form prefill from Vercel's IP geolocation headers (founder 2026-10-18: fewer taps on a
 * phone). US only, a real state, and a city only when the geocoder places it, so a guess never
 * trips the "couldn't place that city" error.
 */
import { describe, expect, it } from "vitest";
import { visitorPlace } from "@/lib/access/visitor-place";

const h = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });

describe("visitorPlace", () => {
  it("a US visitor in a known city gets city and state", () => {
    expect(visitorPlace(h({ "x-vercel-ip-country": "US", "x-vercel-ip-country-region": "OH", "x-vercel-ip-city": "Columbus" }))).toEqual({ city: "Columbus", state: "OH" });
  });

  it("decodes the URL-encoded city header", () => {
    expect(visitorPlace(h({ "x-vercel-ip-country": "US", "x-vercel-ip-country-region": "NV", "x-vercel-ip-city": "Las%20Vegas" }))).toEqual({ city: "Las Vegas", state: "NV" });
  });

  it("a city the geocoder can't place gives the state only", () => {
    expect(visitorPlace(h({ "x-vercel-ip-country": "US", "x-vercel-ip-country-region": "OH", "x-vercel-ip-city": "Tiny%20Hamlet" }))).toEqual({ city: null, state: "OH" });
    expect(visitorPlace(h({ "x-vercel-ip-country": "US", "x-vercel-ip-country-region": "OH", "x-vercel-ip-city": "%E0%A4%A" }))).toEqual({ city: null, state: "OH" });
  });

  it("outside the US, an unknown region or no headers: nothing", () => {
    const none = { city: null, state: null };
    expect(visitorPlace(h({ "x-vercel-ip-country": "CA", "x-vercel-ip-country-region": "ON", "x-vercel-ip-city": "Toronto" }))).toEqual(none);
    expect(visitorPlace(h({ "x-vercel-ip-country": "US", "x-vercel-ip-country-region": "ZZ", "x-vercel-ip-city": "Columbus" }))).toEqual(none);
    expect(visitorPlace(h({}))).toEqual(none);
  });
});
