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
  // The brand's social profiles open in a new tab, with rel="me" and no opener.
  const social = footer.getByTestId("social-links").getByRole("link");
  await expect(social).toHaveCount(3);
  for (const [name, href] of [["Facebook", "https://www.facebook.com/carnivalriderental"], ["Instagram", "https://www.instagram.com/carnivalriderental/"], ["YouTube", "https://www.youtube.com/@carnivalriderental"]]) {
    const link = footer.getByRole("link", { name: `Carnival Ride Rental on ${name}` });
    await expect(link).toHaveAttribute("href", href);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "me noopener noreferrer");
  }
  // No prices, commission or partner/verified claims in the footer.
  expect(await footer.innerText()).not.toMatch(/\$\d|\d+%|commission|verified|partner/i);
});
