import { describe, expect, it } from "vitest";
import { planPhotos, runPhotoImport, sniffImage, type PhotoApi, type PhotoLedgerEntry } from "@/lib/imports/listing-photos";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const HTML = new TextEncoder().encode("<html>not an image</html>");

class Fake implements PhotoApi {
  listings: Record<string, { images: number; state: string; claim: string }> = { "l-1": { images: 0, state: "pendingApproval", claim: "unclaimed" } };
  bytes: Uint8Array = JPEG;
  calls: string[] = [];
  async listingState(id: string) {
    const l = this.listings[id];
    return l ? { images: l.images, state: l.state, metadata: {}, authorClaimStatus: l.claim } : null;
  }
  async download() { this.calls.push("download"); return { bytes: this.bytes, contentType: "image/jpeg" }; }
  async upload() { this.calls.push("upload"); return "img-1"; }
  async attach(id: string) { this.calls.push("attach"); this.listings[id].images = 1; }
  async approve(id: string) { this.calls.push("approve"); this.listings[id].state = "published"; }
}

const item = { externalId: "acme--wheel", companyId: "acme", listingId: "l-1", sourceUrl: "https://acme.example/w.jpg", ridePage: null };
const run = (api: Fake, opts: { approve?: boolean; takedowns?: string[] } = {}) => {
  const out: PhotoLedgerEntry[] = [];
  return runPhotoImport([item], { api, approve: opts.approve, takedowns: new Set(opts.takedowns ?? []), now: () => "t", runId: "r", onResult: (e) => void out.push(e) }).then(() => out);
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
