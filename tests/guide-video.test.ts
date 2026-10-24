import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GUIDES } from "@/lib/content/guides";
import { pageGraph } from "@/lib/seo/structured-data";
import { paths } from "@/lib/seo/routes";

const file = (p: string) => path.join(process.cwd(), "public", p);
const seconds = (ts: string) => ts.split(":").reduce((acc, x) => acc * 60 + Number(x), 0);

describe("guide videos", () => {
  const withVideo = GUIDES.filter((g) => g.video);

  it("the how-to-rent guide has a video", () => {
    expect(withVideo.map((g) => g.id)).toContain("how-to-rent-carnival-rides");
  });

  for (const g of withVideo) {
    const v = g.video!;

    it(`${g.id}: files are in public/video and light enough for the web`, () => {
      for (const p of [v.src, v.poster, v.captions]) {
        expect(p.startsWith("/video/"), p).toBe(true);
        expect(fs.existsSync(file(p)), p).toBe(true);
      }
      expect(fs.statSync(file(v.src)).size).toBeLessThan(8 * 1024 * 1024);
      expect(fs.statSync(file(v.poster)).size).toBeLessThan(300 * 1024);
    });

    it(`${g.id}: captions are valid WebVTT, in order, and say exactly the transcript`, () => {
      const vtt = fs.readFileSync(file(v.captions), "utf8").replace(/\r\n/g, "\n");
      expect(vtt.startsWith("WEBVTT")).toBe(true);
      const cues = [...vtt.matchAll(/(\d\d:\d\d:\d\d\.\d{3}) --> (\d\d:\d\d:\d\d\.\d{3})\n([^\n]+)/g)].map((m) => ({ start: seconds(m[1]), end: seconds(m[2]), text: m[3] }));
      expect(cues.length).toBeGreaterThan(10);
      cues.forEach((c, i) => {
        expect(c.end, c.text).toBeGreaterThan(c.start);
        if (i) expect(c.start, c.text).toBeGreaterThanOrEqual(cues[i - 1].end);
      });
      expect(cues.at(-1)!.end).toBeLessThanOrEqual(v.durationSeconds + 0.5);
      const words = (s: string) => s.replace(/\s+/g, " ").trim();
      expect(words(cues.map((c) => c.text).join(" "))).toBe(words(v.transcript.join(" ")));
    });

    it(`${g.id}: transcript follows the guide copy rules (no prices, guarantees or availability claims)`, () => {
      const text = v.transcript.join(" ");
      expect(text).not.toMatch(/\$\s?\d|\bguarantee|\bavailable on your date|\bbook now\b/i);
    });

    it(`${g.id}: structured data carries one VideoObject linked from the WebPage`, () => {
      const pagePath = paths.guide(g.id);
      const nodes = pageGraph({ path: pagePath, name: g.title, description: g.metaDescription, type: "WebPage", faq: g.faq, video: { ...v, name: v.title } });
      const video = nodes.find((n) => n["@type"] === "VideoObject")!;
      const page = nodes.find((n) => n["@type"] === "WebPage")!;
      expect(video).toMatchObject({ name: v.title, description: v.description, uploadDate: v.uploadDate, duration: "PT1M26S", inLanguage: "en-US" });
      expect(String(video.thumbnailUrl)).toMatch(/\/video\/how-to-rent-carnival-rides-poster\.jpg$/);
      expect(String(video.contentUrl)).toMatch(/\/video\/how-to-rent-carnival-rides\.mp4$/);
      expect(page.video).toEqual({ "@id": video["@id"] });
      expect(String(video["@id"])).toMatch(/\/guides\/how-to-rent-carnival-rides#video$/);
      // Pages without a video carry no VideoObject.
      expect(pageGraph({ path: pagePath, name: g.title, description: g.metaDescription }).some((n) => n["@type"] === "VideoObject")).toBe(false);
    });
  }
});
