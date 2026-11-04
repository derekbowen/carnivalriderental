import { describe, expect, it } from "vitest";
import { discoverRideImage, isConvertibleImage, looksLikePlaceholderUrl, planPhotos, planRecovery, rideTokens, runPhotoImport, sniffImage, type LiveListing, type PhotoApi, type PhotoItem, type PhotoLedgerEntry } from "@/lib/imports/listing-photos";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const HTML = new TextEncoder().encode("<html>not an image</html>");

class Fake implements PhotoApi {
  listings: Record<string, { images: number; state: string; claim: string; metadata?: Record<string, unknown> }> = { "l-1": { images: 0, state: "pendingApproval", claim: "unclaimed" } };
  attached: Record<string, unknown>[] = [];
  toJpeg?: PhotoApi["toJpeg"];
  isPlaceholder?: PhotoApi["isPlaceholder"];
  bytes: Uint8Array = JPEG;
  calls: string[] = [];
  async listingState(id: string) {
    const l = this.listings[id];
    return l ? { images: l.images, state: l.state, metadata: l.metadata ?? {}, authorClaimStatus: l.claim } : null;
  }
  async download() { this.calls.push("download"); return { bytes: this.bytes, contentType: "image/jpeg" }; }
  async upload() { this.calls.push("upload"); return "img-1"; }
  async attach(id: string, _img: string, provenance: Record<string, unknown>) { this.calls.push("attach"); this.attached.push(provenance); this.listings[id].images = 1; }
  async approve(id: string) { this.calls.push("approve"); this.listings[id].state = "published"; }
}

const item = { externalId: "acme--wheel", companyId: "acme", listingId: "l-1", sourceUrl: "https://acme.example/w.jpg", ridePage: null };
const run = (api: Fake, opts: { approve?: boolean; takedowns?: string[]; item?: PhotoItem } = {}) => {
  const out: PhotoLedgerEntry[] = [];
  return runPhotoImport([opts.item ?? item], { api, approve: opts.approve, takedowns: new Set(opts.takedowns ?? []), now: () => "t", runId: "r", onResult: (e) => void out.push(e) }).then(() => out);
};

describe("listing photos", () => {
  it("attaches once and approves; a rerun neither re-uploads nor re-approves", async () => {
    const api = new Fake();
    expect((await run(api, { approve: true }))[0].outcome).toBe("attached_approved");
    expect(api.listings["l-1"]).toMatchObject({ images: 1, state: "published" });
    api.calls = [];
    expect((await run(api, { approve: true }))[0].outcome).toBe("already_has_images");
    expect(api.calls).toEqual([]);
  });

  it("resumes: photo attached but approval missing → approves only", async () => {
    const api = new Fake();
    api.listings["l-1"].images = 1;
    expect((await run(api, { approve: true }))[0].outcome).toBe("approved");
    expect(api.calls).toEqual(["approve"]);
  });

  it("never touches claimed companies or takedowns, and rejects non-images", async () => {
    const claimed = new Fake();
    claimed.listings["l-1"].claim = "claimed";
    expect((await run(claimed, { approve: true }))[0].outcome).toBe("skipped_claimed");
    const td = new Fake();
    expect((await run(td, { approve: true, takedowns: ["acme"] }))[0].outcome).toBe("skipped_takedown");
    const html = new Fake();
    html.bytes = HTML;
    expect((await run(html, { approve: true }))[0].outcome).toBe("bad_image");
    expect(html.listings["l-1"].state).toBe("pendingApproval");
  });

  it("plans only created listings with a source photo; sniffs image types", () => {
    const p = planPhotos(
      [
        { externalId: "a--1", metadata: { companyId: "a" }, privateData: { sourceImageUrl: "https://a/1.jpg" } },
        { externalId: "a--2", metadata: { companyId: "a" }, privateData: {} },
        { externalId: "a--3", metadata: { companyId: "a" }, privateData: { sourceImageUrl: "https://a/3.jpg" } },
      ],
      { "a--1": { listingId: "l", authorId: "u", companyId: "a", createdAt: "" } },
    );
    expect(p).toMatchObject({ noPhoto: 1, notCreated: 1 });
    expect(p.items.map((i) => i.externalId)).toEqual(["a--1"]);
    expect(sniffImage(JPEG)).toBe("image/jpeg");
    expect(sniffImage(HTML)).toBeNull();
  });
});

const WEBP = new Uint8Array([...new TextEncoder().encode("RIFF"), 0, 0, 0, 0, ...new TextEncoder().encode("WEBPVP8 "), 0, 0]);

describe("photo recovery (2026-11-04)", () => {
  it("converts WebP to JPEG before uploading, and rejects placeholders by file name or by look", async () => {
    const webp = new Fake();
    webp.bytes = WEBP;
    webp.toJpeg = async () => JPEG;
    expect(isConvertibleImage(WEBP)).toBe(true);
    expect((await run(webp, { approve: true }))[0].outcome).toBe("attached_approved");
    const noConverter = new Fake();
    noConverter.bytes = WEBP;
    expect((await run(noConverter))[0]).toMatchObject({ outcome: "bad_image", detail: "not a JPEG/PNG/GIF" });
    const byName = new Fake();
    expect((await run(byName, { item: { ...item, sourceUrl: "https://acme.example/img/Photo-Coming-Soon.jpg" } }))[0]).toMatchObject({ outcome: "bad_image", detail: "placeholder graphic (file name)" });
    expect(byName.calls).toEqual([]); // not even downloaded
    const byLook = new Fake();
    byLook.isPlaceholder = async () => true;
    expect((await run(byLook))[0]).toMatchObject({ outcome: "bad_image", detail: "placeholder graphic" });
    expect(byLook.calls).toEqual(["download"]);
  });

  it("replaces a placeholder this importer added, never an operator's own upload, and records why", async () => {
    const ours = new Fake();
    ours.listings["l-1"] = { images: 1, state: "published", claim: "unclaimed", metadata: { photoSource: "operator_website" } };
    expect((await run(ours, { item: { ...item, replace: true, foundOn: "ride page <img>" } }))[0].outcome).toBe("attached");
    expect(ours.attached[0]).toMatchObject({ replaced: "placeholder graphic", foundOn: "ride page <img>" });
    const theirs = new Fake();
    theirs.listings["l-1"] = { images: 1, state: "published", claim: "unclaimed", metadata: {} };
    expect((await run(theirs, { item: { ...item, replace: true } }))[0].outcome).toBe("already_has_images");
    expect(theirs.calls).toEqual([]);
  });

  it("plans from Live: retries recorded photos, searches ride pages, never touches operator-created listings", () => {
    const ph = "https://sharetribe.imgix.net/m/placeholder-image";
    const base = { title: "Sky Diver", state: "published", imageUrls: [] as string[] };
    const listings: LiveListing[] = [
      { ...base, id: "a", privateData: { importExternalId: "x--a", companyId: "x", sourceImageUrl: "https://x.example/a.jpg" } },
      { ...base, id: "b", imageUrls: [ph], privateData: { importExternalId: "x--b", companyId: "x", sourceImageUrl: "https://x.example/coming-soon.png", sourceRidePage: "https://x.example/rides/sky-diver" } },
      { ...base, id: "c", privateData: { importExternalId: "x--c", companyId: "x" } },
      { ...base, id: "d", privateData: {} },
      { ...base, id: "e", imageUrls: ["https://sharetribe.imgix.net/m/real"], privateData: { importExternalId: "x--e", companyId: "x" } },
      { ...base, id: "f", state: "closed", privateData: { importExternalId: "x--f", companyId: "x", sourceImageUrl: "https://x.example/f.jpg" } },
    ];
    const p = planRecovery(listings, (u) => u === ph);
    expect(p.items).toEqual([{ externalId: "x--a", companyId: "x", listingId: "a", sourceUrl: "https://x.example/a.jpg", ridePage: null, replace: false }]);
    expect(p.discover).toEqual([{ externalId: "x--b", companyId: "x", listingId: "b", title: "Sky Diver", ridePage: "https://x.example/rides/sky-diver", replace: true }]);
    expect(p.counts).toEqual({ "no photo: retry the source photo": 1, "placeholder: search the ride page": 1, "no source photo and no ride page": 1, "not an imported listing (never touched)": 1 });
  });

  it("knows placeholder file names", () => {
    for (const u of ["https://a.example/wp-content/uploads/placeholder.png", "https://a.example/no-image.jpg", "https://a.example/Image%20Not%20Available.jpg", "https://a.example/default_photo.jpg"]) expect(looksLikePlaceholderUrl(u), u).toBe(true);
    for (const u of ["https://a.example/rides/sky-diver.jpg", "https://a.example/uploads/2024/zipper-1.jpg"]) expect(looksLikePlaceholderUrl(u), u).toBe(false);
  });
});

describe("ride page photo search", () => {
  const page = "https://acme.example/rides/";
  it("picks the image named for the ride, never logos, icons or tiny images", () => {
    expect(rideTokens("Ferris Wheel 20 ft")).toEqual(["ferris", "wheel", "20"]);
    const html = `
      <img src="/img/logo.png" alt="Sky Diver Rentals logo">
      <img src="/img/fb-icon.png" alt="Sky Diver on Facebook">
      <img src="/img/thumb.jpg" alt="Sky Diver" width="80">
      <img src="/img/ferris-wheel-30ft.jpg" alt="Ferris Wheel">
      <img data-src="/img/ferris-wheel-20ft.jpg" src="data:image/gif;base64,R0l" alt="">
      <img srcset="/img/zipper-400.jpg 400w, /img/zipper-1200.jpg 1200w" alt="Zipper ride">`;
    expect(discoverRideImage(html, page, "Ferris Wheel 20 ft")).toEqual({ url: "https://acme.example/img/ferris-wheel-20ft.jpg", matched: ["ferris", "wheel", "20"], how: "img" });
    expect(discoverRideImage(html, page, "Zipper")).toMatchObject({ url: "https://acme.example/img/zipper-1200.jpg" });
    expect(discoverRideImage(html, page, "Sky Diver")).toBeNull(); // only a logo, an icon and an 80 px thumb name it
    expect(discoverRideImage(html, page, "Tilt-A-Whirl")).toBeNull();
  });

  it("uses og:image only on a page about the ride", () => {
    const html = `<meta property="og:image" content="https://cdn.acme.example/uploads/IMG_2041.jpg">`;
    expect(discoverRideImage(html, "https://acme.example/rides/sky-diver", "Sky Diver")).toEqual({ url: "https://cdn.acme.example/uploads/IMG_2041.jpg", matched: ["sky", "diver"], how: "og:image" });
    expect(discoverRideImage(html, "https://acme.example/our-rides", "Sky Diver")).toBeNull();
    expect(discoverRideImage(`<meta property="og:image" content="/site-logo.png">`, "https://acme.example/rides/sky-diver", "Sky Diver")).toBeNull();
  });
});
