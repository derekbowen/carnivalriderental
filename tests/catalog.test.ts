import { afterEach, describe, expect, it } from "vitest";
import { catalog } from "@/lib/catalog";
import { isIndexable, isRenderable } from "@/lib/catalog/publication";
import { buildSitemap } from "@/lib/sitemap";
import { absolute, paths } from "@/lib/urls";
import { priceLabel } from "@/lib/pricing";
import { fixtureRides } from "@/data/fixtures/catalog";

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

describe("publication gates", () => {
  it("fixtures render only when SHOW_FIXTURES=on", () => {
    process.env.SHOW_FIXTURES = "off";
    expect(catalog.rides()).toHaveLength(0);
    process.env.SHOW_FIXTURES = "on";
    expect(catalog.rides().length).toBeGreaterThan(0);
  });

  it("fixtures are never indexable or in the sitemap, even if marked published and indexing is on", () => {
    process.env.SHOW_FIXTURES = "on";
    process.env.SITE_INDEXING = "on";
    const tampered = { ...fixtureRides[0], publication: { status: "published" as const, reviewedBy: "x", reviewedAt: "2026-01-01" } };
    expect(isRenderable(tampered)).toBe(true);
    expect(isIndexable(tampered)).toBe(false);
    expect(buildSitemap()).toEqual([absolute(paths.home()), absolute(paths.rides())]);
  });

  it("nothing is indexable while SITE_INDEXING is off", () => {
    process.env.SITE_INDEXING = "off";
    expect(buildSitemap()).toEqual([]);
    const prod = { dataset: "production" as const, publication: { status: "published" as const, reviewedBy: "a", reviewedAt: "b" } };
    expect(isIndexable(prod)).toBe(false);
    process.env.SITE_INDEXING = "on";
    expect(isIndexable(prod)).toBe(true);
  });

  it("an unlisted ride + city pair does not exist", () => {
    process.env.SHOW_FIXTURES = "on";
    expect(catalog.cityRide("tx", "austin", "ferris-wheel-rental")).toBeDefined();
    expect(catalog.cityRide("oh", "columbus", "ferris-wheel-rental")).toBeUndefined();
    expect(catalog.cityRide("tx", "austin", "carousel-rental")).toBeUndefined();
  });
});

describe("canonical URLs", () => {
  it("have one form: lowercase, no trailing slash, absolute from SITE_URL", () => {
    process.env.SITE_URL = "https://example.test/";
    expect(absolute(paths.home())).toBe("https://example.test");
    expect(absolute(paths.ride("ferris-wheel-rental"))).toBe("https://example.test/rides/ferris-wheel-rental");
    expect(absolute(paths.cityRide("tx", "austin", "ferris-wheel-rental"))).toBe(
      "https://example.test/locations/tx/austin/ferris-wheel-rental",
    );
    expect(() => paths.ride("Ferris-Wheel")).toThrow();
    expect(() => paths.city("TX", "austin")).toThrow();
  });
});

describe("price labels", () => {
  it("keep estimates, sent quotes and accepted quotes visibly different", () => {
    const est = priceLabel({ kind: "estimate", lowCents: 1_500_000, highCents: 3_000_000, placeholder: false });
    const ph = priceLabel({ kind: "estimate", lowCents: 1, highCents: 2, placeholder: true });
    const sent = priceLabel({ kind: "quote", cents: 2_200_000, status: "sent" });
    const acc = priceLabel({ kind: "quote", cents: 2_200_000, status: "accepted" });
    expect(est.label).toMatch(/^Estimate/);
    expect(ph.label).toMatch(/Placeholder/);
    expect(sent.label).toMatch(/awaiting your acceptance/);
    expect(acc.label).toBe("Accepted quote");
    expect(new Set([est.tone, sent.tone, acc.tone]).size).toBe(3);
  });
});
