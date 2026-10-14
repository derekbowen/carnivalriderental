import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { RIDES, toCard } from "@/lib/inventory";
import { MatchedOperator } from "@/lib/access/matching";
import { fixtureSource } from "@/lib/access/contacts";
import { geocode, matchOperators, memoryContactCache } from "@/lib/access/matching";

/**
 * The locked layer must never reach a public surface. These checks run on the data that public
 * pages are built from; e2e/access.spec.ts checks the rendered HTML.
 */
const IDENTITY_KEYS = ["author", "authorId", "operatorId", "companyName", "company", "contactName", "contactEmail", "email", "phone", "phoneNumber", "website", "hqCity", "hqStreet", "privateData", "protectedData"];
const CONTACT_RE = /[\w.+-]+@[\w-]+\.[\w.]+|\(\d{3}\)\s?\d{3}-\d{4}|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b|https?:\/\/(?!sharetribe\.imgix\.net)/;

describe("public surfaces carry no operator identity", () => {
  it("the inventory snapshot has no identity keys and no contact-shaped strings", () => {
    const keys = new Set<string>();
    for (const r of RIDES) for (const k of Object.keys(r)) keys.add(k);
    for (const k of IDENTITY_KEYS) expect([...keys]).not.toContain(k);
    const raw = fs.readFileSync("src/lib/inventory/rides.json", "utf8");
    expect(raw).not.toMatch(CONTACT_RE);
  });

  it("public cards expose only ride facts", () => {
    const card = toCard(RIDES[0]);
    for (const k of IDENTITY_KEYS) expect(Object.keys(card)).not.toContain(k);
    expect(JSON.stringify(card)).not.toMatch(/bookable|stripe|payout/i);
  });

  it("match snapshots stored on event requests are anonymous", async () => {
    const c = geocode("Columbus", "OH")!;
    const r = await matchOperators({ lat: c.lat, lng: c.lng, state: "OH", rideType: "ferris-wheel" }, fixtureSource(), memoryContactCache());
    const keys = new Set<string>();
    const walk = (o: unknown) => { if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) { keys.add(k); walk(v); } };
    walk(r.operators);
    for (const k of ["companyName", "contactName", "email", "phone", "website", "hqCity"]) expect([...keys]).not.toContain(k);
    const op: MatchedOperator = r.operators[0];
    expect(op.label).toMatch(/^Operator [A-Z]/);
    expect(JSON.stringify(r.operators)).not.toMatch(/Fixture Amusements|555 010|example\.test/);
  });
});
