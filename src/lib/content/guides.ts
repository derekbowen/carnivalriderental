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

/**
 * A short explainer video for the guide, served from public/video (no third-party player or
 * tracking). The transcript is the script as recorded; it follows the same copy rules as the guide.
 */
export interface GuideVideo {
  title: string;
  description: string;
  /** Public paths of the files in public/video. */
  src: string;
  poster: string;
  captions: string;
  durationSeconds: number;
  /** ISO date the video was published on the site. */
  uploadDate: string;
  transcript: string[];
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
  /** Checklist heading and intro; the quote-comparison wording when omitted. */
  checklistTitle?: string;
  checklistIntro?: string;
  faq: Faq[];
  video?: GuideVideo;
  /** Contextual links to other guides (ids in GUIDES), with the sentence that introduces each. */
  related?: { id: string; text: string }[];
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
      { group: "Equipment", questions: ["Does the company quoting own the ride, or book it from another company?", "Which exact ride (make and model) is quoted?", "Rider requirements (height, age) for this ride?", "Footprint and clear area required?", "Are photos of the actual unit available?"] },
      { group: "Price", questions: ["Total price for the quoted hours and dates?", "What is included: transport, crew, generator, fuel, setup and teardown?", "What costs extra: overtime, extra days, accommodations, permits?", "Deposit, balance due date and payment methods?"] },
      { group: "Logistics", questions: ["Arrival and departure times?", "Power needed or provided?", "Access and parking needs for vehicles?", "Who provides fencing, lighting or ticketing if needed?"] },
      { group: "Risk", questions: ["Certificate of insurance and limits?", "Current inspections or certifications where required?", "Weather and cancellation policy?", "Who signs the contract, and when?"] },
    ],
    related: [
      { id: "ride-owner-vs-rental-broker", text: "Not sure whether a company owns the ride it is quoting? Read ride owner vs. rental broker: what’s the difference, with questions about ownership, crews, insurance and inspections." },
      { id: "ferris-wheel-rental-cost", text: "Renting a Ferris wheel? How much does it cost to rent a Ferris wheel explains what changes the quote and how to compare quotes." },
    ],
    faq: [
      { q: "How far in advance should I contact operators?", a: "As early as you can for weekend dates in spring, summer and fall, and for holidays. Operators book a season at a time, and the first company you reach may already be committed on your date, which is a good reason to contact several." },
      { q: "Should I contact more than one operator?", a: "Yes. Equipment, service areas, crews and prices differ, and availability on a specific date is only known to the operator. Comparing two or three quotes with the same checklist is the most reliable way to judge value." },
      { q: "Does Carnival Ride Rental handle the booking?", a: "No. We show operator inventory, help you find rides near your event, and give you direct contact details through Event Access. The rental contract, deposit and payment are between you and the operator." },
      { q: "What if an operator can’t do my date?", a: "Move to the next matching operator. Event Access covers several operators for one event, so a “no” from one company is not a dead end." },
    ],
    video: {
      title: "How to rent carnival rides, in 90 seconds",
      description: "What to have ready before you call an operator, what to ask about transport, power, staffing, insurance, permits, crew and weather, and how to compare quotes.",
      src: "/video/how-to-rent-carnival-rides.mp4",
      poster: "/video/how-to-rent-carnival-rides-poster.jpg",
      captions: "/video/how-to-rent-carnival-rides.en.vtt",
      durationSeconds: 86,
      uploadDate: "2026-10-14",
      transcript: [
        "Renting a carnival ride? Here’s what to sort out before you sign.",
        "It’s a logistics job, not just a booking. Equipment, crew and schedule all shape the price.",
        "Before you call, have this ready: date, location, hours, crowd size, the rides you want, and truck access. And “I don’t know yet” is a normal answer.",
        "Then ask every operator about seven things.",
        "Transport: is there a travel charge, and how long is setup and teardown?",
        "Power: does the ride need three-phase power? Is a generator, and fuel, included?",
        "Staffing: are ride operators included? How many hours, and what does overtime cost?",
        "Insurance: can they provide a certificate, and add your venue as additional insured?",
        "Permits: who applies? You, the venue or the operator? Ask early.",
        "Crew: hotel rooms or RVs? And where do the trucks park overnight?",
        "Weather: what stops the ride, and when does your deposit become non-refundable?",
        "Compare two or three quotes side by side. The cheapest headline price is rarely the cheapest quote.",
        "Reach out early. Operators book a season at a time, so contact several.",
        "Find carnival rides near your event at carnivalriderental.us.",
      ],
    },
  },
  {
    id: "ride-owner-vs-rental-broker",
    title: "Ride owner vs. rental broker: what’s the difference?",
    metaTitle: "Ride Owner vs. Rental Broker: What’s the Difference?",
    metaDescription: "How direct carnival ride rentals and brokered rentals work, who you contract with in each, and the questions to ask any rental company about ride ownership, operating crews, insurance and inspections.",
    intro:
      "When you rent a carnival ride, you deal either with the business that owns and runs the ride, or with a company that arranges the rental for you and books the ride from someone else. Both are legitimate ways to rent. They differ in who you sign with, who shows up on the day and who answers for the equipment, so it helps to know which one you are talking to. This guide explains both and gives you the questions to ask any company before you sign. Answers vary by company, ride, venue and state, so treat every item as something to confirm, not a rule.",
    sections: [
      {
        id: "direct-rental",
        heading: "How a direct rental works",
        intro: "In a direct rental you deal with the ride’s owner-operator: the business that owns the equipment, brings it to your site and staffs it.",
        items: [
          "You agree the price, dates, hours and site requirements with the business that brings the ride",
          "Your contract, deposit and payment are with that business",
          "Questions about setup, power, crew and weather go to the people who run the ride",
          "Any certificate of insurance or inspection paperwork you ask for comes from the company operating the ride",
        ],
      },
      {
        id: "brokered-rental",
        heading: "How a brokered rental works",
        intro: "A broker, booking agent or event company takes your booking and arranges the ride through an owner-operator. Some coordinate several vendors at once, such as rides, games, tents and staff, so you don't have to organise each one yourself.",
        items: [
          "Your contract may be with the broker, while the ride, crew and insurance belong to another company",
          "The broker is paid for arranging the rental, through their own quote or a commission from the ride operator; ask which",
          "Who you call on the day, and who handles a breakdown or a weather stop, depends on the agreement",
          "A broker can be useful when you want one point of contact for several rides or services",
        ],
        note: "Neither model is automatically cheaper or better. What matters is knowing who you are contracting with and who is responsible for the ride.",
      },
      {
        id: "ownership",
        heading: "Questions about ride ownership",
        intro: "Ask these early, before you compare prices. A clear answer is a good sign either way.",
        items: [
          "Do you own this ride, or are you booking it from another company?",
          "If another company supplies it, what is that company called, and can I speak with them?",
          "Who is my contract with, and who takes the deposit?",
          "Are the photos you sent of the actual unit that would come to my event?",
        ],
      },
      {
        id: "crew",
        heading: "Questions about the operating crew",
        intro: "The people who set up and run the ride matter as much as the ride itself.",
        items: [
          "Whose crew delivers, sets up, operates and tears down the ride?",
          "How many attendants run the ride, and are they included in the price?",
          "Who is in charge on site, and how do I reach them during the event?",
          "What happens if the ride breaks down or has to stop for weather?",
        ],
      },
      {
        id: "insurance",
        heading: "Questions about insurance",
        intro: "Venues often set their own insurance requirements. Find out what yours needs, then confirm whose policy covers the ride.",
        items: [
          "Whose insurance covers this ride: yours, the ride owner’s, or both?",
          "Can you provide a certificate of insurance before the event, naming the company that operates the ride?",
          "Can my organisation or venue be named as additional insured?",
          "Do the coverage limits meet my venue’s requirements?",
        ],
        note: "We don’t verify any company’s insurance. Ask for the certificate and check it against your venue’s requirements.",
      },
      {
        id: "inspections",
        heading: "Questions about inspections",
        intro: "Amusement ride inspection and permit rules are set at state and local level and differ widely. Ask early; approvals can take weeks.",
        items: [
          "Does my state or city require an inspection or permit for this ride, and who arranges it?",
          "Can you show the ride’s most recent inspection record or certificate, where one is required?",
          "Who carries out the checks before the ride opens on the day?",
          "Does the venue or fire marshal need any paperwork from the ride operator?",
        ],
      },
      {
        id: "how-we-fit",
        heading: "Where Carnival Ride Rental fits",
        intro: "Carnival Ride Rental is a directory, not a broker. We list rides from independent ride operators, and Event Access gives you the contact details of operators that match your event, so you talk to them directly.",
        items: [
          "We don’t take bookings, resell rides or sign rental contracts",
          "You contact each operator directly, compare their quotes and arrange the rental with them",
          "We charge a one-time access fee and take no commission or markup on the rental price",
          "We don’t verify who owns each ride, so ask every operator the ownership questions above",
        ],
      },
    ],
    checklistTitle: "Questions to ask any rental company",
    checklistIntro: "Ask every company the same questions and write the answers side by side, so you can see who you would actually be dealing with.",
    checklist: [
      { group: "Ownership", questions: ["Do you own the ride you are quoting?", "If not, who does, and can I speak with them?", "Who is my contract with?"] },
      { group: "Crew", questions: ["Whose crew sets up and runs the ride?", "How many attendants, and are they included?", "Who is in charge on site?"] },
      { group: "Insurance", questions: ["Whose policy covers the ride?", "Certificate of insurance before the event?", "Venue named as additional insured?"] },
      { group: "Inspections", questions: ["Inspection or permit required here, and who arranges it?", "Most recent inspection record, where required?", "Who does the checks before opening?"] },
    ],
    faq: [
      { q: "Is a broker more expensive than renting from the ride owner?", a: "Not necessarily. A broker is paid for arranging the rental, but quotes depend on the ride, distance, dates, hours and what is included. Compare like-for-like quotes using the same questions." },
      { q: "Can a broker be the better choice?", a: "Sometimes. If you want one company to coordinate several rides, games or other services, a broker or event company can take that work off your hands. Confirm who owns and runs each ride and who your contract is with." },
      { q: "Is Carnival Ride Rental a broker?", a: "No. We don’t take bookings or resell rides. Event Access gives you direct contact details for independent ride operators that match your event, and you arrange the rental with them. We charge a one-time access fee and take no commission or markup on the rental price." },
      { q: "Do you verify that operators own their rides?", a: "No. Listings come from independent ride operators, and we don’t verify the ownership of each ride. Ask each operator the ownership questions in this guide before you sign." },
    ],
    related: [{ id: "how-to-rent-carnival-rides", text: "Ready to call operators? How to rent carnival rides covers what to have ready and what to ask about transport, power, staffing, permits and weather, with a quote checklist." }],
  },
  {
    // Search Console 2026-10-24: "ferris wheel rental cost", "how much to rent a ferris wheel" and similar.
    id: "ferris-wheel-rental-cost",
    title: "How much does it cost to rent a Ferris wheel?",
    metaTitle: "How Much Does It Cost to Rent a Ferris Wheel?",
    metaDescription: "Ferris wheel rental prices are set by each operator, per event. What changes the quote (the wheel, travel, days and hours, crew, power, permits) and how to compare quotes like for like.",
    intro:
      "There is no standard price list for renting a Ferris wheel. Each operator quotes per event, after hearing your date, location, hours and site, and two quotes for the same day can differ a lot because they include different things. This guide explains what changes a Ferris wheel quote, what to ask about what's included, and how to compare quotes like for like. Carnival Ride Rental doesn't set or collect rental prices: you get quotes directly from the operators.",
    sections: [
      {
        id: "what-changes-the-price",
        heading: "What changes the price",
        intro: "These are the parts of a Ferris wheel quote that change the most from one event to the next.",
        items: [
          "The wheel itself: a mini wheel for young children, a standard fair wheel and a giant wheel are very different pieces of equipment to move, set up and run",
          "Distance: the wheel travels on trucks and trailers from the operator's base, so travel time and fuel are often part of the quote",
          "Days and hours: how many days the wheel stays on site, and how many hours a day it runs",
          "Setup and teardown: a larger wheel takes longer to build and take down, which can add crew time",
          "Crew: the attendants who load riders and run the wheel throughout your event",
          "Power: whether the operator brings a generator and fuel, or needs power on site",
          "Your date: weekends, holidays and the spring-to-fall fair season are when operators are busiest",
        ],
      },
      {
        id: "whats-included",
        heading: "Questions to ask about what's included",
        intro: "Ask every operator the same questions, so a short quote and a complete one don't look alike.",
        items: [
          "Are delivery, setup and teardown included, or quoted separately?",
          "Are ride attendants included for the whole event, and what does it cost if the event runs long?",
          "Is a generator and its fuel included, or do you need power on site?",
          "Is there a charge for a second day, or for running into the evening?",
          "Who arranges any permit or inspection the venue or city requires, and is that included?",
          "Can you provide a certificate of insurance, and is there a charge to name my venue on it?",
          "How much is the deposit, and when does it become non-refundable?",
        ],
      },
      {
        id: "how-to-compare",
        heading: "How to compare Ferris wheel quotes",
        intro: "A low headline price can leave out what another quote includes. Compare the whole event, not the rate.",
        items: [
          "Write the answers from each operator side by side, using the same questions",
          "Compare the total for your event, not an hourly or daily rate on its own",
          "Check which wheel each quote is for, and ask for photos of the actual unit",
          "Confirm the space, ground and access the wheel needs before you compare prices",
        ],
      },
      {
        id: "how-we-fit",
        heading: "Getting quotes through Carnival Ride Rental",
        intro: "We list Ferris wheels from independent ride operators and show you, free, how many match your event.",
        items: [
          "Event Access gives you the contact details of matching operators, so you can ask each one for a quote",
          "We charge a one-time access fee and take no commission or markup on the rental price",
          "Prices, dates and terms are agreed directly between you and each operator",
        ],
      },
    ],
    checklistTitle: "Ferris wheel quote checklist",
    checklistIntro: "Send every operator the same details and ask the same questions, then compare the answers side by side.",
    checklist: [
      { group: "The wheel", questions: ["Which wheel is quoted, and can I see photos of it?", "How much space and overhead clearance does it need?"] },
      { group: "Price", questions: ["What does the total include?", "Any travel, setup, extra-day or overtime charges?", "Deposit amount and refund terms?"] },
      { group: "On the day", questions: ["How many attendants, and for how long?", "Generator and fuel, or site power?", "Who handles permits and inspections?"] },
      { group: "Paperwork", questions: ["Certificate of insurance before the event?", "Venue named on the certificate?"] },
    ],
    faq: [
      { q: "Why won’t anyone give me a Ferris wheel price online?", a: "Because the price depends on your date, location, site and hours. Most operators quote after hearing those details, so have them ready and you will get quotes faster." },
      { q: "Does the size of the wheel change the price?", a: "It can, because a larger wheel takes more to transport, set up and staff. Ask each operator to quote the wheel that suits your space and your guests, and compare like with like." },
      { q: "Does Carnival Ride Rental set the price?", a: "No. Operators set their own prices and quote you directly. We charge a one-time Event Access fee for their contact details and take no commission or markup on the rental." },
      { q: "How far ahead should I ask for quotes?", a: "As early as you can, especially for weekends in spring, summer and fall. Only the operator knows whether a wheel is free on your date, which is a good reason to contact several." },
    ],
    related: [
      { id: "ferris-wheel-wedding-rental", text: "Planning a wheel for a wedding? Renting a Ferris wheel for a wedding covers the venue, space, timing and questions to ask." },
      { id: "how-to-rent-carnival-rides", text: "Renting other rides too? How to rent carnival rides covers what to ask about transport, power, staffing, permits and weather." },
    ],
  },
  {
    // Search Console 2026-10-24: "rent ferris wheel for wedding" ranks on page one with no page written for it.
    id: "ferris-wheel-wedding-rental",
    title: "Renting a Ferris wheel for a wedding",
    metaTitle: "Renting a Ferris Wheel for a Wedding: What to Know",
    metaDescription: "Planning a Ferris wheel at your wedding? What to check with your venue, the space, access and power a wheel needs, timing around the reception, and the questions to ask operators.",
    intro:
      "A Ferris wheel at a wedding gives guests a ride and gives you photos with a view. It is also a large piece of equipment arriving at a venue that may never have hosted one, so the planning starts with the venue. This guide covers what to check with your venue, what an operator will need from you, and the questions to ask before you sign. Requirements vary by wheel, operator, venue and location, so treat every item as something to confirm.",
    sections: [
      {
        id: "venue",
        heading: "Start with your venue",
        intro: "Ask the venue these before you contact operators. Their answers decide what is possible.",
        items: [
          "Does the venue allow amusement rides on its grounds?",
          "Where could a wheel stand, and is the ground there firm and level?",
          "Can trucks and trailers reach that spot, and when can they arrive and leave?",
          "Does the venue need insurance paperwork or other documents from the ride operator?",
          "Are there rules on noise, lighting or a finish time for the evening?",
        ],
      },
      {
        id: "space-access-power",
        heading: "Space, access and power",
        intro: "An operator needs these details to tell you which wheel fits.",
        items: [
          "The size of the area, and anything overhead such as trees, wires, tents or a roof line",
          "The route from the road to the setup spot, including gates, slopes and tight turns",
          "Whether there is power near the spot, or whether the operator should bring a generator",
          "Where the wheel would sit in view of the reception, if photos of it matter to you",
        ],
      },
      {
        id: "timing",
        heading: "Timing on the day",
        intro: "A wheel is built before guests arrive and taken down after they leave.",
        items: [
          "How long before the ceremony does your crew need to arrive and set up?",
          "Can the wheel run during the reception only, and which hours are included?",
          "Does setup or teardown have to happen outside the venue’s event hours?",
          "What happens to the plan if weather stops the wheel?",
        ],
      },
      {
        id: "guests",
        heading: "Your guests",
        intro: "Tell the operator who will ride, so they can suggest a wheel and staffing that suit your reception.",
        items: [
          "Roughly how many guests you expect, and whether children will ride",
          "Whether guests in formal wear, or with limited mobility, are likely to want a ride",
          "Whether the wheel should run for the whole reception or for a set time",
        ],
      },
      {
        id: "operator-questions",
        heading: "Questions to ask each operator",
        intro: "Ask these of every operator you contact and compare the answers side by side.",
        items: [
          "Which wheel do you suggest for our space and guest count, and can I see photos of it?",
          "Are attendants included for the whole time the wheel runs?",
          "Can you provide a certificate of insurance for our venue before the event?",
          "Who arranges any permit or inspection the venue or city requires?",
          "What deposit do you need, and what are your cancellation and weather terms?",
        ],
      },
    ],
    checklistTitle: "What to have ready before you call",
    checklistIntro: "Operators quote faster when you can answer these on the first call.",
    checklist: [
      { group: "The day", questions: ["Wedding date?", "Ceremony and reception times?", "Expected number of guests?"] },
      { group: "The venue", questions: ["Has the venue approved a ride?", "Setup spot size and anything overhead?", "Access route for trucks and trailers?"] },
      { group: "Power and paperwork", questions: ["Power near the setup spot?", "Venue's requirements for vendor insurance?"] },
    ],
    faq: [
      { q: "Can you rent a Ferris wheel for a wedding?", a: "Yes. Some operators rent Ferris wheels for private events, including weddings. Whether one fits depends on your venue’s rules, the space and the access, so check those first, then contact operators near the venue." },
      { q: "How much does a wedding Ferris wheel cost?", a: "Each operator quotes per event, after hearing your date, venue, hours and site. How much does it cost to rent a Ferris wheel explains what changes the quote and how to compare quotes." },
      { q: "How far ahead should we contact operators?", a: "As soon as your date and venue are set. Wedding season overlaps with the busiest months for fairs and festivals, and only the operator knows whether a wheel is free on your date." },
      { q: "Could a carousel work instead?", a: "It is another option couples consider, and it suits all ages. The same venue, space, access and power questions apply, so ask them of carousel operators too." },
    ],
    related: [
      { id: "ferris-wheel-rental-cost", text: "Comparing quotes? How much does it cost to rent a Ferris wheel explains what changes the price and what to ask about what's included." },
      { id: "how-to-rent-carnival-rides", text: "Adding other rides? How to rent carnival rides covers transport, power, staffing, permits and weather." },
    ],
  },
];

export const guideById = (id: string) => GUIDES.find((g) => g.id === id);
