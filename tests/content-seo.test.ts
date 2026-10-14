import { afterEach, describe, expect, it } from "vitest";
import { getContent } from "@/lib/content";
import { demoContent } from "@/lib/content/demo/fixtures";
import { checkContentIntegrity } from "@/lib/content/integrity";
import { allSeoRoutes, rideCityGate, rideGate } from "@/lib/seo/publication";
import { canonicalUrl, paths } from "@/lib/seo/routes";
import { projectMargin } from "@/lib/requests/margin";

const ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ENV };
});

describe("content integrity", () => {
  it("demo fixtures pass the demo checks", () => {
    expect(checkContentIntegrity(demoContent, "demo")).toEqual([]);
  });

  it("demo data cannot be placed into the publishable set", () => {
    const errors = checkContentIntegrity(demoContent, "published");
    expect(errors.some((e) => e.includes("demo record placed in the publishable set"))).toBe(true);
    expect(errors.some((e) => e.includes("demo estimate"))).toBe(true);
    expect(errors.some((e) => e.includes("placeholder images"))).toBe(true);
  });

  it("a demo fixture claiming a verified spec is rejected", () => {
    const tampered = structuredClone(demoContent);
    tampered.rides[0].specs[0] = { label: "Height", value: "100 ft", verification: { status: "verified", source: "made up" } };
    expect(checkContentIntegrity(tampered, "demo").join()).toMatch(/claims verified/);
  });

  it("demo coverage claims are rejected", () => {
    const tampered = structuredClone(demoContent);
    tampered.coverage.push({ rideSlug: "ferris-wheel-rental", stateSlug: "texas", citySlug: "austin", note: "x", verification: { status: "verified", source: "x" } });
    expect(checkContentIntegrity(tampered, "demo").join()).toMatch(/verified coverage/);
  });

  it("production never loads demo content, even if the flag says so", () => {
    process.env.APP_ENV = "production";
    process.env.ALLOW_DEMO_CONTENT = "true";
    expect(getContent().rides.filter((r) => r.isDemo)).toHaveLength(0);
  });
});

describe("publication gates", () => {
  it("nothing is indexable in development", () => {
    process.env.APP_ENV = "development";
    expect(allSeoRoutes().filter((r) => r.gate.indexable)).toEqual([]);
  });

  it("demo records stay non-indexable even with production indexing switched on", () => {
    process.env.APP_ENV = "preview"; // demo content loads outside production
    const rides = getContent().rides;
    process.env.APP_ENV = "production";
    process.env.PUBLIC_INDEXING = "true";
    for (const r of rides) {
      const g = rideGate(r);
      expect(g.indexable).toBe(false);
      expect(g.reasons).toContain("demo fixture");
    }
  });

  it("ride+city pages require verified coverage", () => {
    const ride = demoContent.rides[0];
    const loc = demoContent.locations[0];
    expect(rideCityGate(ride, loc).reasons).toContain("no verified coverage for this ride in this location");
  });
});

describe("canonical routes", () => {
  it("every generated route has a consistent absolute canonical with no trailing slash or query", () => {
    process.env.SITE_URL = "https://dev.example.test/";
    for (const r of allSeoRoutes()) {
      const c = canonicalUrl(r.path);
      expect(c).toBe(`https://dev.example.test${r.path}`);
      expect(c.endsWith("/")).toBe(false);
      expect(c).not.toContain("?");
      expect(r.path).toMatch(/^\/[a-z0-9/-]+$/);
    }
    expect(canonicalUrl("/")).toBe("https://dev.example.test");
  });

  it("route builders reject malformed slugs", () => {
    expect(() => paths.ride("Ferris Wheel")).toThrow();
    expect(() => paths.city("texas", "../etc")).toThrow();
    expect(() => canonicalUrl("/rides?category=x")).toThrow();
  });

  it("route families resolve to unique paths", () => {
    const all = allSeoRoutes().map((r) => r.path);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("margin projection", () => {
  it("keeps unknown costs unknown and never reports a complete margin with gaps", () => {
    const m = projectMargin(2_200_000, { id: "q", requestId: "r", supplierId: "s", supplierPriceCents: 1_200_000, transportCents: 200_000, crewCents: null, otherCents: null, notes: null, createdAt: "" }, null);
    expect(m.knownCostsCents).toBe(1_400_000);
    expect(m.marginBeforeUnknownsCents).toBe(800_000);
    expect(m.isComplete).toBe(false);
    expect(m.unknownComponents).toEqual(["Setup, teardown & operating crew", "Other fulfilment costs", "Payment processing costs"]);
  });
  it("has no margin without a customer price", () => {
    expect(projectMargin(null, null, null).marginBeforeUnknownsCents).toBeNull();
  });
});
