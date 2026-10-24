import fs from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("indexing pilot allowlist", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.doUnmock("@/lib/inventory/pilot"); });

  it("is enabled for the recorded waves, and every listed path is a real page that meets its supply gate", async () => {
    const { PSEO_PILOT, FIRST_COHORT_PATHS } = await import("@/lib/inventory/pilot");
    const { inventoryRoutes } = await import("@/lib/inventory");
    const wave2 = JSON.parse(fs.readFileSync("src/lib/inventory/indexing-wave-2.json", "utf8"));
    expect(PSEO_PILOT.enabled).toBe(true);
    // The authorization and the content review are recorded separately (the founder did not review pages).
    expect(PSEO_PILOT.authorization).toMatch(/Founder instruction, 2026-10-14/);
    expect(PSEO_PILOT.authorization).toMatch(/lets index 1000 pages/);
    expect(PSEO_PILOT.contentReview).toMatch(/NOT by the founder/);
    expect(wave2.authorization).toMatch(/Founder instruction, 2026-10-14/);
    expect(wave2.contentReview).toMatch(/NOT reviewed page by page by the founder/);
    // Wave 1 first and unchanged; wave 2 adds category hubs and city / ride + city pages up to the target.
    expect([...PSEO_PILOT.corePaths]).toEqual(["/", "/rides", "/categories/ferris-wheels", ...wave2.categoryPaths]);
    expect(PSEO_PILOT.paths.slice(0, FIRST_COHORT_PATHS.length)).toEqual([...FIRST_COHORT_PATHS]);
    const all = [...PSEO_PILOT.paths, ...PSEO_PILOT.corePaths];
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBe(wave2.targetIndexableUrls);
    const routes = new Map(inventoryRoutes().map((r) => [r.path, r]));
    for (const p of PSEO_PILOT.paths) {
      expect(routes.has(p), p).toBe(true);
      expect(routes.get(p)!.gate.reasons.some((x) => x.startsWith("only ")), p).toBe(false);
    }
    // No two pilot pages fall in the same near-duplicate group.
    const heads = JSON.parse(fs.readFileSync("reports/pseo-duplicates.json", "utf8")).groupHeadOf as Record<string, string>;
    for (const p of PSEO_PILOT.paths) expect(heads[p] ?? p, p).toBe(p);
  }, 30_000); // evaluates every route's gate on the full snapshot

  it("when enabled it stands in for copy approval on listed paths only, never for the environment or supply gates", async () => {
    vi.doMock("@/lib/inventory/pilot", () => ({
      PSEO_PILOT: { enabled: true, paths: ["/ohio/columbus", "/alaska/anchorage"] },
      inPilot: (p: string) => ["/ohio/columbus", "/alaska/anchorage"].includes(p),
    }));
    const inv = await import("@/lib/inventory");
    const columbus = inv.cityBySlugs("ohio", "columbus")!;
    const anchorage = inv.cityBySlugs("alaska", "anchorage")!;
    const austin = inv.cityBySlugs("texas", "austin")!;
    // Environment gate still closed.
    expect(inv.inventoryCityGate(columbus).indexable).toBe(false);
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("PUBLIC_INDEXING", "true");
    expect(inv.inventoryCityGate(columbus)).toEqual({ indexable: true, reasons: [] });
    expect(inv.inventoryCityGate(austin).indexable).toBe(false); // not on the list
    expect(inv.inventoryCityGate(anchorage).indexable).toBe(false); // listed, but thin
    expect(inv.inventoryRideCityGate(columbus, "ferris-wheel").indexable).toBe(false); // only the exact path counts
  });
});

describe("wave 3: event pages and buyer guides (founder 2026-10-24)", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

  it("records its authorization, lists only real pages, and opens them only with indexing on", async () => {
    const { WAVE_3, inPilot } = await import("@/lib/inventory/pilot");
    const { GUIDES } = await import("@/lib/content/guides");
    const { OCCASIONS } = await import("@/lib/taxonomy");
    const { paths } = await import("@/lib/seo/routes");
    const { guideGate } = await import("@/lib/seo/pseo");
    expect(WAVE_3.authorization).toMatch(/Founder instruction, 2026-10-24/);
    expect(WAVE_3.contentReview).toMatch(/NOT reviewed page by page by the founder/);
    const events = new Set(OCCASIONS.map((o) => paths.occasion(o.id)));
    for (const p of WAVE_3.eventPaths) expect(events.has(p), p).toBe(true);
    const guides = new Set(GUIDES.map((g) => paths.guide(g.id)));
    expect([...WAVE_3.guidePaths].sort()).toEqual([...guides].sort());
    for (const p of [...WAVE_3.eventPaths, ...WAVE_3.guidePaths]) expect(inPilot(p), p).toBe(true);
    // Only the listed event pages: the state versions and other events stay out.
    expect(inPilot("/events/weddings/texas")).toBe(false);
    expect(inPilot("/events/bar-mitzvahs")).toBe(false);
    expect(guideGate("ferris-wheel-rental-cost").indexable).toBe(false);
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("PUBLIC_INDEXING", "true");
    expect(guideGate("ferris-wheel-rental-cost")).toEqual({ indexable: true, reasons: [] });
  });
});

describe("near-duplicate gate (only group heads can be indexed)", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.doUnmock("@/lib/inventory/pilot"); vi.doUnmock("@/lib/inventory/index-eligible.json"); });
  const approveAll = () => vi.doMock("@/lib/inventory/pilot", () => ({ PSEO_PILOT: { enabled: true, paths: [] }, inPilot: () => true }));

  it("the eligible list matches the current snapshot", async () => {
    const eligible = JSON.parse(fs.readFileSync("src/lib/inventory/index-eligible.json", "utf8"));
    const { INVENTORY_GENERATED_AT } = await import("@/lib/inventory");
    expect(eligible.inventoryGeneratedAt).toBe(INVENTORY_GENERATED_AT);
  });

  it("with every other gate open, only heads are indexable; non-heads stay noindex with a self-canonical", async () => {
    approveAll();
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("PUBLIC_INDEXING", "true");
    const inv = await import("@/lib/inventory");
    const head = inv.cityBySlugs("california", "san-francisco")!;
    const member = inv.cityBySlugs("california", "oakland")!;
    expect(inv.inventoryCityGate(head)).toEqual({ indexable: true, reasons: [] });
    const g = inv.inventoryCityGate(member);
    expect(g.indexable).toBe(false);
    expect(g.reasons.join()).toMatch(/near-duplicate/);
    const meta = inv.inventoryMetadata({ path: "/california/oakland", title: "t", description: "d", gate: g });
    expect(meta.robots).toEqual({ index: false, follow: true });
    expect(meta.alternates?.canonical).toMatch(/\/california\/oakland$/);
    const routes = inv.inventoryRoutes();
    const eligible = JSON.parse(fs.readFileSync("src/lib/inventory/index-eligible.json", "utf8"));
    expect(routes.filter((r) => r.gate.indexable).length).toBe(eligible.count);
  }, 30_000); // evaluates every route's gate on the full snapshot

  it("a stale list blocks indexing everywhere", async () => {
    approveAll();
    vi.doMock("@/lib/inventory/index-eligible.json", () => ({ default: { inventoryGeneratedAt: "old", paths: ["/california/san-jose"] } }));
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("PUBLIC_INDEXING", "true");
    const inv = await import("@/lib/inventory");
    const g = inv.inventoryCityGate(inv.cityBySlugs("california", "san-jose")!);
    expect(g.indexable).toBe(false);
    expect(g.reasons.join()).toMatch(/stale/);
  });
});
