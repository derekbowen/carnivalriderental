import type { ContentSet } from "../types";

/**
 * DEVELOPMENT FIXTURES — NOT PUBLISHABLE.
 *
 * Every record here is isDemo: true and recordStatus: "demo". The content
 * integrity check (src/lib/content/integrity.ts) rejects any demo record that
 * claims verified facts or published status, and production never loads this file.
 *
 * Rules followed: no invented dimensions, capacities, manufacturer specs, reviews,
 * supplier counts, insurance or certification claims. Spec values are null
 * ("Not yet verified"). Estimates are explicitly flagged as demo values.
 */

const unverified = { status: "unverified" as const };

const placeholder = (name: string) => ({
  src: `/placeholders/ride-placeholder.svg`,
  alt: `Development placeholder image for ${name} — not a photograph of real equipment`,
  license: "dev-placeholder" as const,
});

export const demoContent: ContentSet = {
  categories: [
    {
      slug: "ferris-wheels",
      name: "Ferris wheels",
      summary: "A landmark attraction for festivals, civic celebrations and large corporate events.",
      description:
        "Ferris wheels range from compact trailer-mounted models to large spectacular wheels. Size, transport, setup time and site requirements vary widely by model, so we confirm every detail with the operator for your specific event.",
      recordStatus: "demo",
      isDemo: true,
    },
    {
      slug: "carousels",
      name: "Carousels",
      summary: "A classic, all-ages ride suited to family days, holiday markets and community events.",
      description:
        "Carousels come in many sizes and styles. Operating requirements depend on the specific unit, which we confirm with the operator before quoting.",
      recordStatus: "demo",
      isDemo: true,
    },
    {
      slug: "swing-rides",
      name: "Swing rides",
      summary: "A high-visibility thrill ride for festivals and fairs with older audiences.",
      description:
        "Swing rides vary by model in height, rider restrictions and footprint. We collect your site details first, then verify fit with the operator.",
      recordStatus: "demo",
      isDemo: true,
    },
  ],

  rides: [
    {
      slug: "ferris-wheel-rental",
      name: "Ferris wheel rental",
      categorySlug: "ferris-wheels",
      summary:
        "A Ferris wheel with a professional operating crew for your event. Independent operators list their wheels here; you confirm scope and price with the operator.",
      description: [
        "A Ferris wheel gives an event a visible centrepiece. Because wheels differ greatly in size, transport needs and setup time, we do not quote a fixed price until we have matched your event to a specific operator and unit.",
        "Have your dates, location, expected attendance and site details ready. The operator confirms the wheel and crew and sends a quote that states exactly what is included.",
        "Nothing is booked until you accept the final scope and price and the booking is confirmed under the agreed payment terms.",
      ],
      suitability: ["Festivals", "Municipal and civic events", "Corporate events", "College events"],
      specs: [
        { label: "Height", value: null, verification: unverified },
        { label: "Rider capacity", value: null, verification: unverified },
        { label: "Site footprint", value: null, verification: unverified },
        { label: "Power requirement", value: null, verification: unverified },
        { label: "Setup time", value: null, verification: unverified },
        { label: "Manufacturer / model", value: null, verification: unverified },
      ],
      estimate: {
        lowUsd: 15000,
        highUsd: 30000,
        basis:
          "Development placeholder range for interface testing only. Not market research and not a price we offer.",
        isDemoValue: true,
      },
      images: [placeholder("Ferris wheel rental"), placeholder("Ferris wheel rental")],
      recordStatus: "demo",
      isDemo: true,
    },
    {
      slug: "carousel-rental",
      name: "Carousel rental",
      categorySlug: "carousels",
      summary:
        "A carousel with operating crew. Confirm the unit, footprint and power needs with the operator before you commit.",
      description: [
        "A carousel suits mixed-age audiences and longer operating days.",
        "Share your event brief with the operator and they send a written quote for the unit and crew.",
      ],
      suitability: ["Family days", "Holiday markets", "School events", "Community festivals"],
      specs: [
        { label: "Rider capacity", value: null, verification: unverified },
        { label: "Site footprint", value: null, verification: unverified },
        { label: "Power requirement", value: null, verification: unverified },
      ],
      estimate: null,
      images: [placeholder("Carousel rental")],
      recordStatus: "demo",
      isDemo: true,
    },
    {
      slug: "swing-ride-rental",
      name: "Swing ride rental",
      categorySlug: "swing-rides",
      summary:
        "A swing ride with operating crew. Rider restrictions and site requirements are confirmed per unit by the operator before quoting.",
      description: [
        "Swing rides draw attention from across an event site.",
        "Tell us about your site and audience. We verify fit with the operator before sending a quote.",
      ],
      suitability: ["Festivals", "Fairs", "College events"],
      specs: [
        { label: "Height", value: null, verification: unverified },
        { label: "Rider restrictions", value: null, verification: unverified },
        { label: "Site footprint", value: null, verification: unverified },
      ],
      estimate: null,
      images: [placeholder("Swing ride rental")],
      recordStatus: "demo",
      isDemo: true,
    },
  ],

  locations: [
    {
      stateSlug: "texas",
      stateName: "Texas",
      stateCode: "TX",
      citySlug: "austin",
      cityName: "Austin",
      localNotes: [],
      recordStatus: "demo",
      isDemo: true,
    },
    {
      stateSlug: "ohio",
      stateName: "Ohio",
      stateCode: "OH",
      citySlug: "columbus",
      cityName: "Columbus",
      localNotes: [],
      recordStatus: "demo",
      isDemo: true,
    },
    {
      stateSlug: "colorado",
      stateName: "Colorado",
      stateCode: "CO",
      citySlug: "denver",
      cityName: "Denver",
      localNotes: [],
      recordStatus: "demo",
      isDemo: true,
    },
  ],

  // No verified coverage exists. Do not add entries without a real, documented source.
  coverage: [],
};
