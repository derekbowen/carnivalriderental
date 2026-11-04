/**
 * Hidden listing images (src/lib/catalog/hidden-images.ts): placeholder graphics copied as a ride's photo
 * and images that identify the operator read as no photo everywhere a listing photo appears.
 */
import { describe, expect, it } from "vitest";
import ridesFile from "@/lib/inventory/rides.json";
import { HIDDEN_IMAGES, isHiddenImage, isPlaceholderImage } from "@/lib/catalog/hidden-images";
import { listingPhotos, OPERATOR_LISTING_TYPE, toOperatorCard } from "@/lib/catalog/operator-search";
import { RIDES } from "@/lib/inventory";

const cdn = (image: string) => `https://sharetribe.imgix.net/6acf1c8d-2742-48f6-9229-7356d6d62a30/${image}?auto=format&w=400&s=x`;
const [placeholder] = [...HIDDEN_IMAGES].find(([, why]) => why === "placeholder graphic")!;
const [identifying] = [...HIDDEN_IMAGES].find(([, why]) => why !== "placeholder graphic")!;

describe("hidden listing images", () => {
  it("matches by the image id in the CDN path, for every size, and only on Sharetribe's CDN", () => {
    expect(isHiddenImage(cdn(placeholder))).toBe(true);
    expect(isHiddenImage(cdn(placeholder).replace("w=400", "w=800"))).toBe(true);
    expect(isHiddenImage(`https://example.org/x/${placeholder}`)).toBe(false);
    expect(isHiddenImage(null)).toBe(false);
    expect(isPlaceholderImage(placeholder)).toBe(true);
    expect(isPlaceholderImage(cdn(identifying))).toBe(false); // hidden, but not a placeholder to replace
  });

  it("every hidden image was in the snapshot, and none is left on a snapshot ride", () => {
    const raw = (ridesFile as { rides: { photo: string | null }[] }).rides;
    const ids = new Set(raw.flatMap((r) => (r.photo ? [new URL(r.photo).pathname.split("/")[2]] : [])));
    for (const id of HIDDEN_IMAGES.keys()) expect(ids.has(id), id).toBe(true);
    expect(RIDES.filter((r) => isHiddenImage(r.photo) || isHiddenImage(r.thumb))).toEqual([]);
    expect(RIDES.filter((r) => r.photo).length).toBe(raw.filter((r) => r.photo).length - HIDDEN_IMAGES.size);
  });

  it("live listing cards and galleries drop them", () => {
    const listing = {
      id: "l-1",
      type: "listing",
      attributes: { title: "Sky Diver", state: "published", publicData: { listingType: OPERATOR_LISTING_TYPE } },
      relationships: { images: { data: [{ id: "i-1", type: "image" }, { id: "i-2", type: "image" }] } },
    };
    const image = (id: string, url: string) => ({ id, type: "image", attributes: { variants: { "landscape-crop": { url }, "landscape-crop2x": { url }, "square-small": { url } } } });
    const included = [image("i-1", cdn(placeholder)), image("i-2", cdn("real-photo"))];
    expect(listingPhotos(listing as never, included as never).map((p) => p.src)).toEqual([cdn("real-photo")]);
    // The card shows the first image that isn't hidden; with only a placeholder, no photo.
    expect(toOperatorCard(listing as never, included as never, null)!.photo?.src).toBe(cdn("real-photo"));
    const only = toOperatorCard({ ...listing, relationships: { images: { data: [{ id: "i-1", type: "image" }] } } } as never, included as never, null);
    expect(only).not.toBeNull();
    expect(only!.photo).toBeNull();
    expect(only!.photoLarge).toBeNull();
  });
});
