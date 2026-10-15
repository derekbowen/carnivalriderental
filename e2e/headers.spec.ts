import { expect, test } from "@playwright/test";

// Security scan 2026-10-15 (docs/SECURITY_SCAN_2026-10-15.md): the headers every response carries, the
// homepage share image, and the accessibility statement.
test("security headers on every response, share image and accessibility statement", async ({ request }) => {
  for (const path of ["/", "/s", "/concierge", "/privacy"]) {
    const h = (await request.get(path)).headers();
    expect(h["x-content-type-options"], path).toBe("nosniff");
    expect(h["x-frame-options"], path).toBe("SAMEORIGIN");
    expect(h["content-security-policy"], path).toContain("frame-ancestors 'self'");
    expect(h["content-security-policy"], path).toContain("base-uri 'self'");
    expect(h["content-security-policy"], path).toContain("object-src 'none'");
    expect(h["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"], path).toContain("camera=()");
  }
  const home = await (await request.get("/")).text();
  expect(home).toMatch(/property="og:image" content="[^"]*\/brand\/carnival-ride-rental-logo\.png"/);
  expect(home).toContain('href="/accessibility"');
  const statement = await request.get("/accessibility");
  expect(statement.status()).toBe(200);
  expect(await statement.text()).toContain("WCAG");
});
