import type { Faq } from "../taxonomy";

/**
 * Buyer education (/guides/{id}). Public and free: the site must be useful before anyone pays.
 *
 * Copy rules: requirements vary by ride, operator, venue and jurisdiction, so everything is phrased
 * as questions to ask or things to have ready, never as universal rules. No prices, no capacities,
 * no legal claims, no supplier counts.
 */
export interface GuideSection {
  id: string;
  heading: string;
  intro: string;
  /** Bullet points: things to know, or questions to ask (each ends with a question mark). */
  items: string[];
  note?: string;
}

export interface Guide {
  id: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  sections: GuideSection[];
  /** The standardised questions for comparing quotes from several operators. */
  checklist: { group: string; questions: string[] }[];
  faq: Faq[];
}

export const GUIDES: Guide[] = [
  {
    id: "how-to-rent-carnival-rides",
    title: "How to rent carnival rides for an event",
    metaTitle: "How to Rent Carnival Rides: A Buyer’s Guide",
    metaDescription: "What to have ready before you call a carnival ride operator, the questions to ask about transport, power, staffing, insurance, permits and weather, and a checklist for comparing quotes.",
    intro:
      "Renting a carnival ride is a logistics job as much as a booking. The operator brings a large piece of equipment, a crew and a schedule to your site, and the price depends on all three. This guide covers what operators will ask you, what you should ask them, and how to compare quotes from more than one company. Requirements vary by ride, operator, venue and jurisdiction, so treat every item here as a question to settle with the operator, not a rule.",
    sections: [
      {
        id: "before-you-call",
        heading: "Before you call an operator",
        intro: "Operators quote faster and more accurately when you have the basics ready. Have these written down before your first call or email.",
        items: [
          "Event date, and whether the date is fixed or flexible",
          "Event location: address, venue type and whether the site is public or private",
          "Operating hours: when the ride should open and close, each day",
          "Estimated attendance across the event",
          "Age range of your guests, including whether young children or teens dominate",
          "Ride types you have in mind, or the feel you want (a landmark, a family ride, a kiddie area)",
          "Available setup area: rough dimensions and anything overhead such as trees, wires or a roof line",
          "Surface type: grass, asphalt, concrete, gravel, an indoor floor",
          "Truck and trailer access: gate widths, turns, slopes and where a trailer can park and unload",
        ],
        note: "Not sure about something? Say so. “I don’t know yet” is a normal answer; the operator can tell you what to measure.",
      },
      {
        id: "transportation",
        heading: "Ask about transportation",
        intro: "Large rides travel on semis or trailers, and moving them is often a meaningful part of the cost. Ask each operator how your event fits their route.",
        items: [
          "How does the ride travel, and how many vehicles arrive on site?",
          "Is there a mobilization or travel charge, and how is it calculated?",
          "How far is your site from their base, and is there a distance beyond which they don’t travel?",
          "How long do setup and teardown take, and when would they arrive and leave?",
          "Where will the trucks and trailers stay during the event?",
        ],
      },
      {
        id: "power",
        heading: "Ask about power",
        intro: "Power needs vary widely between rides. Some operators bring generators; others expect power on site. Ask rather than assume.",
        items: [
          "Does this ride need three-phase power, or standard service?",
          "Does the operator provide a generator, and is it included in the price?",
          "Who supplies the fuel, and is fuel included?",
          "If using site power, what electrical service and connection does the ride require?",
          "How far can the ride be from the power source?",
        ],
      },
      {
        id: "staffing",
        heading: "Ask about staffing",
        intro: "Most rides are run by the operator’s own crew, but what is included and for how long differs from one company to another.",
        items: [
          "Are ride operators included in the price?",
          "How many attendants does this ride need to run?",
          "Is the setup crew the same as the operating crew?",
          "Who handles teardown, and when?",
          "How many operating hours are included, and what does overtime cost?",
          "What happens during crew breaks: does the ride stop?",
        ],
      },
      {
        id: "insurance",
        heading: "Ask about insurance",
        intro: "Venues, cities and schools often set their own insurance requirements. Find out what your venue needs, then ask the operator what they can provide.",
        items: [
          "Can the operator provide a certificate of insurance before the event?",
          "What coverage limits does the operator carry, and do they meet your venue’s requirements?",
          "Can your organisation or venue be named as additional insured?",
          "Does your city, county or venue have its own insurance requirements for amusement rides?",
          "Who is responsible for guest injuries, property damage and equipment damage?",
        ],
        note: "We don’t state universal legal requirements here because they differ by state, venue and event. Confirm them with your venue and the operator.",
      },
      {
        id: "permits",
        heading: "Permits and inspections",
        intro: "Amusement ride regulation is set at state and local level, and venues add their own rules. Ask early; approvals can take weeks.",
        items: [
          "Does your state or city require a permit or inspection for temporary amusement rides?",
          "Does the operator hold current state inspections or certifications for the ride, where required?",
          "Who applies for event permits: you, the venue or the operator?",
          "Does the venue require vendor paperwork, a site plan or a fire marshal review?",
          "Are there noise, lighting or hours restrictions on the site?",
        ],
      },
      {
        id: "crew",
        heading: "Crew accommodations",
        intro: "For traveling shows and multi-day events, the crew may need somewhere to stay. Some operators include this; others itemise it or ask the host to provide it.",
        items: [
          "Does the crew need hotel rooms, or do they travel with RVs or living quarters?",
          "Is overnight parking for trucks, trailers and RVs available at or near the site?",
          "Is a per diem or meal allowance expected?",
          "How does the crew get between the site and their accommodation?",
        ],
        note: "Not every operator needs any of this. Ask so there are no surprises on the invoice.",
      },
      {
        id: "weather",
        heading: "Weather and cancellation",
        intro: "Rides have operating limits, and outdoor events have weather. Settle the policy before you sign, not on the day.",
        items: [
          "What wind speed, rain or lightning conditions stop the ride?",
          "What is the rain policy: does the ride wait it out, or shut for the day?",
          "What are the cancellation terms, and when does the deposit become non-refundable?",
          "Can the event be rescheduled, and at what cost?",
          "How much deposit is required, when is the balance due, and how is it paid?",
        ],
      },
    ],
    checklist: [
      { group: "Equipment", questions: ["Which exact ride (make and model) is quoted?", "Rider requirements (height, age) for this ride?", "Footprint and clear area required?", "Are photos of the actual unit available?"] },
      { group: "Price", questions: ["Total price for the quoted hours and dates?", "What is included: transport, crew, generator, fuel, setup and teardown?", "What costs extra: overtime, extra days, accommodations, permits?", "Deposit, balance due date and payment methods?"] },
      { group: "Logistics", questions: ["Arrival and departure times?", "Power needed or provided?", "Access and parking needs for vehicles?", "Who provides fencing, lighting or ticketing if needed?"] },
      { group: "Risk", questions: ["Certificate of insurance and limits?", "Current inspections or certifications where required?", "Weather and cancellation policy?", "Who signs the contract, and when?"] },
    ],
    faq: [
      { q: "How far in advance should I contact operators?", a: "As early as you can for weekend dates in spring, summer and fall, and for holidays. Operators book a season at a time, and the first company you reach may already be committed on your date, which is a good reason to contact several." },
      { q: "Should I contact more than one operator?", a: "Yes. Equipment, service areas, crews and prices differ, and availability on a specific date is only known to the operator. Comparing two or three quotes with the same checklist is the most reliable way to judge value." },
      { q: "Does Carnival Ride Rental handle the booking?", a: "No. We show operator inventory, help you find rides near your event, and give you direct contact details through Event Access. The rental contract, deposit and payment are between you and the operator." },
      { q: "What if an operator can’t do my date?", a: "Move to the next matching operator. Event Access covers several operators for one event, so a “no” from one company is not a dead end." },
    ],
  },
];

export const guideById = (id: string) => GUIDES.find((g) => g.id === id);
