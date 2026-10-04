import crypto from "node:crypto";
import { openDb } from "@/lib/db";

export function freshDb() {
  return openDb(":memory:");
}

export function future(days = 120): string {
  return new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10);
}

export function briefBody(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: crypto.randomUUID(),
    rideSlug: "ferris-wheel-rental",
    rideFlexibility: "similar_rides_ok",
    dateStart: future(),
    dateEnd: null,
    dateFlexibility: "fixed",
    city: "Austin",
    state: "tx",
    venue: "Riverside park",
    operatingHours: "10am–8pm",
    eventType: "festival",
    expectedAttendance: "2000_10000",
    budget: "10k_25k",
    siteAccess: "not_sure",
    availableSpace: "not_sure",
    power: "not_sure",
    notes: null,
    contactName: "Test Customer",
    contactEmail: "Customer@Example.com",
    contactPhone: null,
    organization: "Test Org",
    ...overrides,
  };
}
