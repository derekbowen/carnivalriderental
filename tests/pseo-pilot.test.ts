import fs from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("indexing pilot allowlist", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.doUnmock("@/lib/inventory/pilot"); });

  it("is disabled and every listed path is a real page that meets its supply gate", async () => {
    const { PSEO_PILOT } = await import("@/lib/inventory/pilot");
    const { inventoryRoutes } = await import("@/lib/inventory");
    expect(PSEO_PILOT.enabled).toBe(false);
    const routes = new Map(inventoryRoutes().map((r) => [r.path, r]));
    for (const p of PSEO_PILOT.paths) {
      expect(routes.has(p), p).toBe(true);
      expect(routes.get(p)!.gate.reasons.some((x) => x.startsWith("only ")), p).toBe(false);
    }
    // No two pilot pages fall in the same near-duplicate group.
    const heads = JSON.parse(fs.readFileSync("reports/pseo-duplicates.json", "utf8")).groupHeadOf as Record<string, string>;
    for (const p of PSEO_PILOT.paths) expect(heads[p] ?? p, p).toBe(p);
  });

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
