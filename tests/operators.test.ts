import { describe, expect, it } from "vitest";
import { OperatorApplications, operatorApplicationSchema, submitOperatorApplication } from "@/lib/operators/applications";
import { OPERATOR_PROGRAM } from "@/lib/operators/program";
import { openDb } from "@/lib/requests/db";
import { operatorPageGate } from "@/lib/seo/publication";

const valid = {
  companyName: "Example Amusements LLC",
  contactName: "Pat Example",
  email: "Pat@Example.test ",
  phone: "+1 (555) 010-0000",
  homeState: "TX",
  statesServed: "tx, OK;la",
  rides: "1 Ferris wheel, 2 kiddie rides",
  consent: true,
};
const store = () => new OperatorApplications(openDb(":memory:"));

describe("operator applications", () => {
  it("normalises email, state codes and the served-states list", () => {
    const r = operatorApplicationSchema.parse(valid);
    expect(r.email).toBe("pat@example.test");
    expect(r.homeState).toBe("tx");
    expect(r.statesServed).toEqual(["tx", "ok", "la"]);
  });

  it("rejects missing consent, bad email, unknown states and unknown keys", () => {
    expect(operatorApplicationSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
    expect(operatorApplicationSchema.safeParse({ ...valid, email: "nope" }).success).toBe(false);
    expect(operatorApplicationSchema.safeParse({ ...valid, statesServed: "TX, XX" }).success).toBe(false);
    expect(operatorApplicationSchema.safeParse({ ...valid, homeState: "PR" }).success).toBe(false);
    expect(operatorApplicationSchema.safeParse({ ...valid, isVerified: true }).success).toBe(false);
  });

  it("stores one row per email; a resubmission updates it", () => {
    const s = store();
    expect(submitOperatorApplication(valid, s).status).toBe(201);
    expect(submitOperatorApplication({ ...valid, rides: "1 Ferris wheel, 1 carousel" }, s).status).toBe(201);
    const all = s.list();
    expect(all).toHaveLength(1);
    expect(all[0].submissions).toBe(2);
    expect(all[0].application.rides).toBe("1 Ferris wheel, 1 carousel");
    expect(all[0].application).not.toHaveProperty("consent");
  });

  it("reports field errors and never stores invalid or honeypot submissions", () => {
    const s = store();
    const bad = submitOperatorApplication({ ...valid, email: "x" }, s);
    expect(bad.status).toBe(400);
    expect(bad.body).toMatchObject({ ok: false, fields: { email: expect.any(String) } });
    expect(submitOperatorApplication({ ...valid, fax: "buy now" }, s)).toEqual({ status: 201, body: { ok: true } });
    expect(s.list()).toHaveLength(0);
  });
});

describe("operator program page", () => {
  it("commission is configured at 0 and the service fee is undecided (the page promises neither)", () => {
    expect(OPERATOR_PROGRAM.operatorCommissionPct).toBe(0);
    expect(OPERATOR_PROGRAM.customerServiceFeePct).toBeNull();
  });

  it("is never indexable until the copy is approved", () => {
    const env = { ...process.env };
    process.env.APP_ENV = "production";
    process.env.PUBLIC_INDEXING = "true";
    expect(operatorPageGate()).toEqual({ indexable: false, reasons: ["operator page copy not approved"] });
    process.env = env;
  });
});
