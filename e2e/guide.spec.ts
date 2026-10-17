import { expect, test } from "@playwright/test";

test("how-to-rent guide: self-hosted explainer video with captions, transcript and VideoObject", async ({ page, request }) => {
  await page.goto("/guides/how-to-rent-carnival-rides");
  const video = page.locator("video");
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute("preload", "none");
  await expect(video).toHaveAttribute("poster", "/video/how-to-rent-carnival-rides-poster.jpg");

  const src = await page.locator("video source").getAttribute("src");
  const captions = await page.locator('video track[kind="captions"]').getAttribute("src");
  for (const [url, type] of [[src!, /video\/mp4/], [captions!, /text\/vtt/], ["/video/how-to-rent-carnival-rides-poster.jpg", /image\/jpeg/]] as const) {
    const r = await request.get(url);
    expect(r.status(), url).toBe(200);
    expect(r.headers()["content-type"], url).toMatch(type);
  }

  await page.getByText("Read the transcript").click();
  await expect(page.locator("#video-transcript")).toContainText("Then ask every operator about seven things.");

  const doc = JSON.parse((await page.locator('script[type="application/ld+json"]').allTextContents())[0]);
  const nodes = doc["@graph"] as Record<string, unknown>[];
  const videoNode = nodes.find((n) => n["@type"] === "VideoObject")!;
  expect(videoNode).toBeTruthy();
  expect(nodes.find((n) => n["@type"] === "WebPage")!.video).toEqual({ "@id": videoNode["@id"] });
  await page.locator("section[aria-labelledby='video-heading']").screenshot({ path: "test-results/guide-video.png" });
});

test("ride owner vs. rental broker guide: sections, checklist, FAQ JSON-LD, two-way links, no prices", async ({ page, request }) => {
  await page.goto("/guides/ride-owner-vs-rental-broker");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ride owner vs. rental broker: what’s the difference?");
  for (const h of ["How a direct rental works", "How a brokered rental works", "Questions about ride ownership", "Questions about the operating crew", "Questions about insurance", "Questions about inspections", "Where Carnival Ride Rental fits", "Questions to ask any rental company"]) {
    await expect(page.getByRole("heading", { level: 2, name: h })).toBeVisible();
  }
  await expect(page.getByText("We don’t verify who owns each ride, so ask every operator the ownership questions above")).toBeVisible();
  await expect(page.getByTestId("related-guides").getByRole("link")).toHaveAttribute("href", "/guides/how-to-rent-carnival-rides");
  const html = await (await request.get("/guides/ride-owner-vs-rental-broker")).text();
  expect(html).toMatch(/<link rel="canonical" href="[^"]*\/guides\/ride-owner-vs-rental-broker"/);
  const doc = JSON.parse((await page.locator('script[type="application/ld+json"]').allTextContents())[0]);
  const faq = (doc["@graph"] as Record<string, unknown>[]).find((n) => n["@type"] === "FAQPage") as { mainEntity: { name: string }[] };
  expect(faq.mainEntity.map((q) => q.name)).toContain("Is Carnival Ride Rental a broker?");
  const main = await page.locator("article").innerText();
  expect(main).not.toMatch(/\$\s?\d/);

  await page.goto("/guides/how-to-rent-carnival-rides");
  await expect(page.getByTestId("related-guides").getByRole("link")).toHaveAttribute("href", "/guides/ride-owner-vs-rental-broker");
  await expect(page.getByRole("heading", { name: /Owner or broker/ })).toHaveCount(0);
});
