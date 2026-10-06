import { CATEGORY_IDS } from "../contract";

/**
 * Category hub pages: ONE template (src/components/CategoryHub.tsx) + this config.
 *
 * Copy rules (enforced by tests/category-pages.test.ts):
 * - General planning guidance only. No numbers at all: no heights, capacities, rider minimums,
 *   power ratings, prices, counts or timings. Those come from verified unit records or quotes.
 * - No availability, insurance, certification or review claims.
 * - reviewStatus "draft" until the founder approves; a draft hub can render but never index.
 * - One page per intent: "merry-go-round" lives inside the carousel page, never as its own page.
 *
 * Theme changes colour, motif and illustration only. It never affects indexability.
 */
export type CategoryTheme = "ferris" | "carousel" | "swing" | "thrill" | "kiddie";

export interface CategoryPage {
  id: string;
  theme: CategoryTheme;
  /** Display name in breadcrumbs and links. */
  name: string;
  /** Singular, correctly capitalised, for running copy ("a Ferris wheel", "a carousel"). */
  singular: string;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  /** Hero illustration (public/illustrations/categories/{id}.svg). It is an illustration, never a unit photo. */
  heroAlt: string;
  planning: { venueAccess: string; setupSpace: string; power: string; audience: string };
  quoteChecklist: string[];
  faqs: { q: string; a: string }[];
  related: string[];
  reviewStatus: "draft" | "approved";
}

const BOOKED_FAQ = (thing: string) => ({
  q: `When is the ${thing} actually booked?`,
  a: "When you and the operator agree terms directly. Event Access gives you the operator's contact details; the rental contract, deposit and payment are between you and the operator. Browsing or unlocking a contact doesn't reserve a ride.",
});
const OPERATED_FAQ = (thing: string) => ({
  q: `Who sets up and runs the ${thing}?`,
  a: "The operator you contact delivers, sets up and operates the ride with their own crew. You arrange the details directly with them; we are not part of the rental.",
});

export const CATEGORY_PAGES: CategoryPage[] = [
  {
    id: "ferris-wheels",
    singular: "Ferris wheel",
    theme: "ferris",
    name: "Ferris wheels",
    h1: "Ferris wheel rentals",
    metaTitle: "Ferris wheel rentals for events",
    metaDescription: "Rent a Ferris wheel for a festival, civic celebration, wedding or corporate event. Browse Ferris wheels owned by independent operators and connect with them directly.",
    intro:
      "A Ferris wheel gives a festival, civic celebration or large corporate event a landmark guests can see from across the grounds. Browse the wheels operators have listed, then use Event Access to reach the ones near your date and site.",
    heroAlt: "Illustration of a Ferris wheel lit up against an evening city skyline",
    planning: {
      venueAccess: "Wheels travel on trucks and trailers. Tell the operator about gates, tight turns, overhead lines and the route from the road to the setup spot.",
      setupSpace: "Footprint and height vary a lot between models. Share the size of the area and anything overhead, such as trees, wires or a roof line.",
      power: "Some operators bring generators; others need power on site. Tell the operator what power, if any, is available near the setup area.",
      audience: "Tell the operator who your guests are and roughly how many you expect, so they can suggest a wheel that suits the crowd and the evening.",
    },
    quoteChecklist: ["Event dates and operating hours", "Site address and ground surface", "Space available, including anything overhead", "Expected attendance and guest ages", "Power available near the setup area"],
    faqs: [
      { q: "How much space does a Ferris wheel need?", a: "It depends on the model — wheels range from compact units to large festival attractions. Tell the operator the size of your area and any overhead obstructions; they confirm what fits before quoting." },
      { q: "Can you tell me the wheel's height and how many people it carries?", a: "Only the operator can confirm a specific wheel's height and capacity. We show the verified facts from the listing and leave the rest unconfirmed rather than estimate them." },
      OPERATED_FAQ("Ferris wheel"),
      BOOKED_FAQ("Ferris wheel"),
    ],
    related: ["carousels", "swing-rides", "thrill-rides"],
    reviewStatus: "draft",
  },
  {
    id: "carousels",
    singular: "carousel",
    theme: "carousel",
    name: "Carousels",
    h1: "Carousel and merry-go-round rentals",
    metaTitle: "Carousel and merry-go-round rentals",
    metaDescription: "Rent a carousel (merry-go-round) for a family day, holiday market, wedding or community event. Browse carousels owned by independent operators and connect with them directly.",
    intro:
      "A carousel — many people call it a merry-go-round — is an all-ages ride that suits family days, holiday markets, weddings and community events. Browse the carousels operators have listed, then use Event Access to reach the ones near your event.",
    heroAlt: "Illustration of a classic carousel with a scalloped canopy and carved horses",
    planning: {
      venueAccess: "Carousels usually arrive in sections on trailers. Describe the route in from the road and any narrow gates, curbs or tight turns.",
      setupSpace: "A carousel needs a firm, level area. Tell the operator the surface — grass, asphalt, concrete or an indoor floor — and the space you have.",
      power: "Tell the operator what power is available near the setup area; they confirm what their carousel needs.",
      audience: "Carousels suit mixed ages. Let the operator know whether you expect mostly young children, families or adults, and roughly how many guests.",
    },
    quoteChecklist: ["Event dates and operating hours", "Indoor or outdoor, and the floor or ground surface", "Space available and access route", "Expected attendance and guest ages", "Power available near the setup area"],
    faqs: [
      { q: "Is a merry-go-round the same as a carousel?", a: "For event rentals, yes — the two names are used for the same kind of ride. Search for either and you are in the right place; we list them all under carousel rentals." },
      { q: "Can a carousel be set up indoors?", a: "Sometimes. It depends on the model, the room's height, the floor and the way in. Tell the operator about the room and they confirm before quoting." },
      OPERATED_FAQ("carousel"),
      BOOKED_FAQ("carousel"),
    ],
    related: ["kiddie-rides", "ferris-wheels", "swing-rides"],
    reviewStatus: "draft",
  },
  {
    id: "swing-rides",
    singular: "swing ride",
    theme: "swing",
    name: "Swing rides",
    h1: "Swing ride rentals",
    metaTitle: "Swing ride rentals for festivals and events",
    metaDescription: "Rent a swing ride for a festival, fair or college event. Browse swing rides owned by independent operators and connect with them directly.",
    intro:
      "On a swing ride, chairs fly out as the ride turns — a bright, high-visibility attraction for festivals, fairs and campus events. Browse the swing rides operators have listed, then use Event Access to reach the ones near your event.",
    heroAlt: "Illustration of a swing ride with chairs flying outward under an open sky",
    planning: {
      venueAccess: "Swing rides travel on trailers. Tell the operator about the route in, gate widths and where a trailer can park and unload.",
      setupSpace: "The swinging chairs need clear space all around the ride. Tell the operator the size of the area and anything nearby — tents, trees, light poles or wires.",
      power: "Tell the operator what power is available near the setup area; they confirm what their ride needs.",
      audience: "Some swing rides are built for children and others for older riders. Tell the operator your guests' ages so they can suggest the right kind of ride.",
    },
    quoteChecklist: ["Event dates and operating hours", "Site address and ground surface", "Clear space around the setup area", "Expected attendance and guest ages", "Power available near the setup area"],
    faqs: [
      { q: "Are swing rides suitable for children?", a: "Some are and some are not. Rider requirements are set by the operator for each ride, so tell the operator your guests' ages and they match the ride to your audience." },
      { q: "How much space does a swing ride need?", a: "It depends on the ride. The chairs swing outward while it runs, so the clear area around it matters as much as its base. Share your site details with the operator and they confirm fit before quoting." },
      OPERATED_FAQ("swing ride"),
      BOOKED_FAQ("swing ride"),
    ],
    related: ["ferris-wheels", "thrill-rides", "kiddie-rides"],
    reviewStatus: "draft",
  },
  {
    id: "thrill-rides",
    singular: "thrill ride",
    theme: "thrill",
    name: "Thrill rides",
    h1: "Thrill ride rentals",
    metaTitle: "Thrill ride rentals for fairs and festivals",
    metaDescription: "Rent spinning, swinging and drop-style thrill rides for fairs, festivals, after-prom and college events. Browse thrill rides owned by independent operators and connect with them directly.",
    intro:
      "Spinning, swinging and drop-style rides draw teens and adults at fairs, festivals, after-prom nights and campus events. Browse the rides operators have listed, then use Event Access to reach the ones near your event.",
    heroAlt: "Illustration of a pendulum thrill ride swinging high against a dark sky",
    planning: {
      venueAccess: "Larger rides travel on big trailers. Describe the route in, gate widths, turning room and where the trailer can be positioned.",
      setupSpace: "Big rides need firm, level ground and clear space around them. Tell the operator the surface and the dimensions of the area you have.",
      power: "Power needs vary from ride to ride. Tell the operator what is available on site and they confirm what their ride needs.",
      audience: "Every thrill ride has rider requirements set by the manufacturer and operator. Tell the operator the ages and expected numbers so they suggest a ride your guests can actually ride.",
    },
    quoteChecklist: ["Event dates and operating hours", "Site address and ground surface", "Space available and access route", "Guest ages and expected attendance", "Power available on site"],
    faqs: [
      { q: "What rider requirements apply?", a: "Each ride has its own, set by the manufacturer and the operator. The operator confirms them for the specific ride and shares them with you before you book." },
      { q: "Can I contact more than one operator?", a: "Yes. Event Access unlocks several operators per event, so you can compare what each one can supply for your date." },
      OPERATED_FAQ("ride"),
      BOOKED_FAQ("ride"),
    ],
    related: ["swing-rides", "ferris-wheels"],
    reviewStatus: "draft",
  },
  {
    id: "kiddie-rides",
    singular: "kiddie ride",
    theme: "kiddie",
    name: "Kiddie rides",
    h1: "Kiddie ride rentals",
    metaTitle: "Kiddie ride rentals for parties and school events",
    metaDescription: "Rent kiddie rides — small trains, mini coasters, kiddie swings and more — for birthdays, school carnivals and family days. Browse kiddie rides owned by independent operators and connect with them directly.",
    intro:
      "Kiddie rides — small trains, mini coasters, kiddie swings and similar rides built for young children — suit birthdays, school carnivals, church festivals and family days. Browse the rides operators have listed, then use Event Access to reach the ones near your event.",
    heroAlt: "Illustration of a small kiddie train under bunting flags on a sunny day",
    planning: {
      venueAccess: "Note gates, curbs, steps and how far it is from where a trailer can park to the setup area.",
      setupSpace: "Kiddie rides come in many sizes. Tell the operator the area you have, the surface, and whether it is indoors or outdoors.",
      power: "Tell the operator what power is available near the setup area; they confirm what each ride needs.",
      audience: "Tell the operator the children's ages and roughly how many will come. Rider requirements are set by the operator for each ride.",
    },
    quoteChecklist: ["Event dates and operating hours", "Children's ages and expected numbers", "Site address, surface and indoor or outdoor", "Space available and access route", "Power available near the setup area"],
    faqs: [
      { q: "What ages are kiddie rides for?", a: "They are designed for young children, but each ride has its own rider requirements set by the operator. Tell the operator the ages attending and they match rides to them." },
      { q: "Can parents ride along?", a: "On some rides, yes; on others, no. It depends on the ride and the operator's rules, which they confirm before you book." },
      OPERATED_FAQ("kiddie rides"),
      { q: "When are the kiddie rides actually booked?", a: BOOKED_FAQ("rides").a },
    ],
    related: ["carousels", "swing-rides", "ferris-wheels"],
    reviewStatus: "draft",
  },
];

export const categoryPageById = (id: string) => CATEGORY_PAGES.find((c) => c.id === id);

/** Structural checks (also run in tests). */
export function checkCategoryPages(pages: CategoryPage[] = CATEGORY_PAGES): string[] {
  const errs: string[] = [];
  const idsSeen = new Set<string>();
  for (const p of pages) {
    if (!CATEGORY_IDS.includes(p.id)) errs.push(`${p.id}: not a contract category`);
    if (idsSeen.has(p.id)) errs.push(`${p.id}: duplicate`);
    idsSeen.add(p.id);
    for (const r of p.related) if (!pages.some((x) => x.id === r) || r === p.id) errs.push(`${p.id}: bad related ${r}`);
  }
  return errs;
}
