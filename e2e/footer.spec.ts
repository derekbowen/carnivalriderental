import { expect, test } from "@playwright/test";

test("global footer: link columns, states, contact; every link resolves", async ({ page, request }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  for (const t of ["Ride types", "Popular cities", "Events", "Carnival ride rentals by state"]) await expect(footer.getByText(t, { exact: true })).toBeVisible();
  await expect(footer.getByRole("link", { name: "Columbus, OH" }).or(footer.getByRole("link", { name: "Chicago, IL" })).first()).toBeVisible();
  await expect(footer.getByRole("link", { name: /^support@/ })).toHaveAttribute("href", /^mailto:support@/);
  const hrefs = [...new Set(await footer.getByRole("link").evaluateAll((as) => as.map((a) => a.getAttribute("href")!)))].filter((h) => h.startsWith("/") && !h.startsWith("/#"));
  expect(hrefs.length).toBeGreaterThan(60);
  for (const h of hrefs) expect((await request.get(h)).status(), h).toBe(200);
  // No prices, commission or partner/verified claims in the footer.
  expect(await footer.innerText()).not.toMatch(/\$\d|\d+%|commission|verified|partner/i);
});
