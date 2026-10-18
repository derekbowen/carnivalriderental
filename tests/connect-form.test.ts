/**
 * The short Connect form (founder 2026-10-18): one "What ride?" select posts either a ride type id or
 * "class:<id>" for a whole category; the start route maps it onto the request's ride type or class.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { accessDb } from "@/lib/access/db";
import { POST as start } from "@/app/api/access/start/route";

const SITE = "https://carnivalriderental.us";
const BASE = { email: "planner@fastmail.com", eventDate: "2030-06-01", city: "Columbus", state: "OH" };

async function submit(fields: Record<string, string>) {
  const form = new FormData();
  for (const [k, v] of Object.entries({ ...BASE, ...fields })) form.set(k, v);
  const res = await start(new Request(`${SITE}/api/access/start`, { method: "POST", headers: { origin: SITE }, body: form }));
  expect([303, 302, 200]).toContain(res.status);
  const rows = await (await accessDb()).query(`SELECT ride_type, ride_class, event_type, event_date, zip, attendance, budget_cents FROM access_event_requests ORDER BY created_at DESC LIMIT 1`);
  return rows[0];
}

describe("Connect form: one ride select, four fields", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    for (const [k, v] of Object.entries({ APP_ENV: "development", DATABASE_PATH: ":memory:", ACCESS_DATABASE_URL: "", ACCESS_SESSION_SECRET: "connect-form-test-secret-long-enough-0", ACCESS_OPERATOR_SOURCE: "fixture", ACCESS_RATE_LIMIT: "off" })) vi.stubEnv(k, v);
  });

  it("a category choice searches that ride class", async () => {
    expect(await submit({ ride: "class:kiddie" })).toMatchObject({ ride_type: null, ride_class: "kiddie" });
  });

  it("a specific ride searches that ride type", async () => {
    expect(await submit({ ride: "carousel" })).toMatchObject({ ride_type: "carousel", ride_class: null });
  });

  it("the date is optional: blank is stored as no date, a past date is still refused", async () => {
    const row = await submit({ ride: "carousel", eventDate: "" });
    expect(row).toMatchObject({ ride_type: "carousel", event_date: null });
    const form = new FormData();
    for (const [k, v] of Object.entries({ ...BASE, eventDate: "2020-01-01", ride: "carousel" })) form.set(k, v);
    const res = await start(new Request(`${SITE}/api/access/start`, { method: "POST", headers: { origin: SITE }, body: form }));
    expect(res.headers.get("location") ?? (await res.text())).toContain("error=invalid");
  });

  it("'Any carnival ride' and the dropped fields leave them empty; a page's own ride wins", async () => {
    expect(await submit({ ride: "" })).toMatchObject({ ride_type: null, ride_class: null, event_type: null, zip: null, attendance: null, budget_cents: null });
    expect(await submit({ rideType: "ferris-wheel", ride: "carousel" })).toMatchObject({ ride_type: "ferris-wheel" });
  });
});
