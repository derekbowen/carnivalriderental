import { describe, expect, it } from "vitest";
import { approvedRideDescription, rideExcerpt, rideOverview } from "@/lib/catalog/ride-description";
import { UNCLAIMED_NOTICE } from "@/lib/operators/claim";
import { toOperatorCard } from "@/lib/catalog/operator-search";

const imported = { claimStatus: "unclaimed", importBatch: "2026-10-18" };
const listing = (description: string, metadata: Record<string, unknown> = imported) => ({
  id: "6ac255a8-e335-44cc-93e0-5e60a95b017c",
  type: "listing",
  attributes: {
    title: "Bumper Cars",
    state: "published",
    description,
    publicData: { listingType: "operator-ride-rental", rideClass: "family", homeState: "ok" },
    metadata,
  },
  relationships: { images: { data: [] } },
});

describe("public ride description safeguards", () => {
  it("uses anonymous source text while removing the operator claim notice", () => {
    const original = "Guests can steer bumper cars around a dedicated driving area at a carnival or fair.";
    const source = UNCLAIMED_NOTICE + "\n\n" + original;
    const reviewed = { ...imported, publicDescriptionReviewedText: source };
    const safe = approvedRideDescription(source, reviewed);
    expect(safe).toBe(original);
    const card = toOperatorCard(listing(source, reviewed), [], null)!;
    expect(card.description).toBe(original);
    expect(JSON.stringify(card)).not.toContain("has not joined");
  });

  it.each([
    "Call 312-555-0101 to discuss your ride.",
    "Our details are at https://operator.example.com/rides.",
    "Visit www.example.com for availability and pricing.",
    "Contact management@some-company.com for setup.",
    "Operated by Scenic Star Shows at all major events.",
    "We are fully insured and certified to run this ride.",
    "Our office is at 1234 Main Street, Springfield.",
    "Call us today for this amusement ride.",
  ])("rejects identifying or unverified prose: %s", (raw) => {
    expect(approvedRideDescription(raw, { ...imported, publicDescriptionReviewedText: raw })).toBeNull();
  });

  it("fails closed for claimed, unknown and unapproved sources", () => {
    const description = "An exciting bumper car experience for fairs and festivals.";
    expect(approvedRideDescription(description, { claimStatus: "claimed", importBatch: "x" })).toBeNull();
    expect(approvedRideDescription(description, { claimStatus: "unclaimed" })).toBeNull();
    expect(approvedRideDescription(description, {})).toBeNull();
    expect(approvedRideDescription(description, imported)).toBeNull();
    expect(approvedRideDescription(description + " Changed by Cedar Valley.", { ...imported, publicDescriptionReviewedText: description })).toBeNull();
    expect(approvedRideDescription("", imported)).toBeNull();
  });

  it("rejects boilerplate summaries and trims long approved prose", () => {
    expect(approvedRideDescription("Family ride listed by an independent operator.", imported)).toBeNull();
    const long = "The ride turns gently in a circle around its center for family entertainment. ".repeat(25);
    const safe = approvedRideDescription(long, { ...imported, publicDescriptionReviewedText: long });
    expect(safe?.length).toBeLessThanOrEqual(1200);
  });

  it("generates only stated facts when the listing has no approved description", () => {
    const ride = {
      title: "Bumper Cars",
      description: null,
      rideClassLabel: "Family ride",
      facts: [{ label: "Minimum rider height", value: "42 in" }],
    };
    const overview = rideOverview(ride);
    expect(overview).toContain("Bumper Cars");
    expect(overview).toContain("42 in");
    expect(overview).toContain("Confirm");
    expect(overview).not.toMatch(/guarantee|certified|available now|Alamo/i);
    const excerpt = rideExcerpt(ride, 125);
    expect(excerpt.length).toBeLessThanOrEqual(125);
  });

  it("does not expose rejected source prose through fallback cards", () => {
    const card = toOperatorCard(listing("Operated by Scenic Star Shows at our office."), [], null)!;
    expect(card.description).toBeNull();
    expect(rideExcerpt(card)).toContain("Bumper Cars");
    expect(rideOverview(card)).not.toContain("Scenic Star Shows");
  });
});
