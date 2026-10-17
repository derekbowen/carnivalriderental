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

test("how-to-rent guide: owner-or-broker section and FAQ", async ({ page }) => {
  await page.goto("/guides/how-to-rent-carnival-rides");
  await expect(page.getByRole("heading", { name: /Owner or broker\?/ })).toBeVisible();
  await expect(page.getByText("Do you own this ride, or are you booking it from another company?")).toBeVisible();
  await expect(page.getByText("Is Carnival Ride Rental a broker?")).toBeVisible();
});
