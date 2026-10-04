// DEVELOPMENT FIXTURES — demo records for building and testing page templates.
// They are not verified inventory, not partner commitments and not real prices.
// src/lib/catalog/publication.ts keeps them out of the sitemap and marks every
// page that renders one as noindex.
import type { CityRidePage, RideCategory, RideType, ServiceCity } from "@/lib/catalog/types";

const draft = { status: "draft" } as const;
const placeholderImage = (glyph: "ferris" | "carousel" | "swing", alt: string) => ({
  kind: "placeholder" as const,
  glyph,
  alt,
});

export const fixtureCategories: RideCategory[] = [
  {
    slug: "ferris-wheels",
    name: "Ferris wheels",
    summary: "Observation wheels for festivals, civic celebrations and large corporate events.",
    dataset: "fixture",
    publication: draft,
  },
  {
    slug: "carousels",
    name: "Carousels",
    summary: "Classic carousels suited to all-ages events, holiday markets and family days.",
    dataset: "fixture",
    publication: draft,
  },
  {
    slug: "swing-rides",
    name: "Swing rides",
    summary: "Chair-swing rides that suit festivals and fairs with mixed-age crowds.",
    dataset: "fixture",
    publication: draft,
  },
];

export const fixtureRides: RideType[] = [
  {
    slug: "ferris-wheel-rental",
    name: "Ferris wheel rental",
    category: "ferris-wheels",
    summary:
      "A Ferris wheel sourced from an established carnival operator, delivered, set up and run by the operator's crew.",
    description: [
      "Tell us about your event and we look for an operator who can bring a Ferris wheel on your date, with transport, setup, an operating crew and teardown.",
      "Ferris wheels vary widely in size, footprint and power needs. Those details come from the operator we source and are confirmed in your written quote.",
    ],
    suitability: ["Festivals", "Municipal celebrations", "Corporate events", "College events"],
    specs: [
      { label: "Height", verified: false, note: "Varies by operator — confirmed in your quote" },
      { label: "Footprint", verified: false, note: "Varies by operator — confirmed in your quote" },
      { label: "Rider capacity", verified: false, note: "Varies by operator — confirmed in your quote" },
      { label: "Power", verified: false, note: "Varies by operator — confirmed in your quote" },
    ],
    estimate: {
      lowCents: 1_500_000,
      highCents: 3_000_000,
      basis: "Development placeholder range — not market data.",
      placeholder: true,
    },
    image: placeholderImage("ferris", "Ferris wheel"),
    dataset: "fixture",
    publication: draft,
  },
  {
    slug: "carousel-rental",
    name: "Carousel rental",
    category: "carousels",
    summary: "A carousel sourced from an operator, with transport, setup, crew and teardown.",
    description: [
      "We source a carousel and operating crew for your event and send you a written quote before anything is booked.",
    ],
    suitability: ["Holiday markets", "Family days", "Community festivals"],
    specs: [
      { label: "Footprint", verified: false, note: "Varies by operator — confirmed in your quote" },
      { label: "Power", verified: false, note: "Varies by operator — confirmed in your quote" },
    ],
    estimate: null,
    image: placeholderImage("carousel", "Carousel"),
    dataset: "fixture",
    publication: draft,
  },
  {
    slug: "swing-ride-rental",
    name: "Swing ride rental",
    category: "swing-rides",
    summary: "A chair-swing ride sourced from an operator, delivered and run by their crew.",
    description: [
      "We source a swing ride and operating crew for your event and send you a written quote before anything is booked.",
    ],
    suitability: ["Festivals", "County fairs", "College events"],
    specs: [
      { label: "Height", verified: false, note: "Varies by operator — confirmed in your quote" },
      { label: "Footprint", verified: false, note: "Varies by operator — confirmed in your quote" },
    ],
    estimate: null,
    image: placeholderImage("swing", "Swing ride"),
    dataset: "fixture",
    publication: draft,
  },
];

export const fixtureCities: ServiceCity[] = [
  { state: "tx", stateName: "Texas", slug: "austin", name: "Austin", localNotes: [], dataset: "fixture", publication: draft },
  { state: "oh", stateName: "Ohio", slug: "columbus", name: "Columbus", localNotes: [], dataset: "fixture", publication: draft },
];

export const fixtureCityRidePages: CityRidePage[] = [
  { state: "tx", city: "austin", ride: "ferris-wheel-rental", localNotes: [], dataset: "fixture", publication: draft },
];
