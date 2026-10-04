// Validation for the customer's event brief. Technical site questions accept
// "not_sure" so nobody has to invent a measurement to finish the form.

export const NOT_SURE = "not_sure";

export const EVENT_TYPES = ["corporate", "municipal", "school_college", "festival", "private", "other"] as const;
export const RIDE_FLEXIBILITY = ["this_ride_only", "similar_rides_ok", "open_to_suggestions"] as const;
export const DATE_FLEXIBILITY = ["fixed", "flexible_few_days", "flexible_weeks"] as const;
export const SITE_ACCESS = ["paved_truck_access", "grass_or_dirt", "restricted", NOT_SURE] as const;
export const SPACE = ["under_2500_sqft", "2500_10000_sqft", "over_10000_sqft", NOT_SURE] as const;
export const POWER = ["onsite_power_available", "generator_needed", NOT_SURE] as const;
export const ATTENDANCE = ["under_500", "500_2000", "2000_10000", "over_10000", NOT_SURE] as const;
export const BUDGET = ["under_10k", "10k_25k", "25k_50k", "over_50k", NOT_SURE] as const;

export type EventRequestInput = {
  idempotencyKey: string;
  rideSlug: string | null;
  rideFlexibility: (typeof RIDE_FLEXIBILITY)[number];
  dateStart: string;
  dateEnd: string | null;
  dateFlexibility: (typeof DATE_FLEXIBILITY)[number];
  city: string;
  state: string;
  venue: string | null;
  operatingHours: string | null;
  eventType: (typeof EVENT_TYPES)[number];
  expectedAttendance: (typeof ATTENDANCE)[number];
  budget: (typeof BUDGET)[number];
  siteAccess: (typeof SITE_ACCESS)[number];
  availableSpace: (typeof SPACE)[number];
  power: (typeof POWER)[number];
  notes: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  organization: string | null;
};

export type FieldErrors = Partial<Record<keyof EventRequestInput, string>>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUIDISH = /^[A-Za-z0-9_-]{16,80}$/;

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}
function oneOf<T extends readonly string[]>(v: unknown, allowed: T): T[number] | null {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T[number]) : null;
}

export function validateEventRequest(
  raw: unknown,
  opts: { today: string; rideExists: (slug: string) => boolean },
): { ok: true; value: EventRequestInput } | { ok: false; errors: FieldErrors } {
  const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: FieldErrors = {};

  const idempotencyKey = typeof b.idempotencyKey === "string" && UUIDISH.test(b.idempotencyKey) ? b.idempotencyKey : null;
  if (!idempotencyKey) errors.idempotencyKey = "Missing request key. Reload the page and try again.";

  const rideSlug = str(b.rideSlug, 80);
  if (rideSlug && !opts.rideExists(rideSlug)) errors.rideSlug = "Choose a ride from the list, or leave it open.";

  const rideFlexibility = oneOf(b.rideFlexibility, RIDE_FLEXIBILITY);
  if (!rideFlexibility) errors.rideFlexibility = "Tell us how flexible you are on the ride.";
  if (!rideSlug && rideFlexibility === "this_ride_only") errors.rideFlexibility = "Pick a ride, or let us suggest one.";

  const dateStart = str(b.dateStart, 10);
  if (!dateStart || !ISO_DATE.test(dateStart)) errors.dateStart = "Enter your event date.";
  else if (dateStart < opts.today) errors.dateStart = "The event date is in the past.";
  const dateEnd = str(b.dateEnd, 10);
  if (dateEnd && (!ISO_DATE.test(dateEnd) || (dateStart && dateEnd < dateStart)))
    errors.dateEnd = "The end date must be on or after the start date.";
  const dateFlexibility = oneOf(b.dateFlexibility, DATE_FLEXIBILITY);
  if (!dateFlexibility) errors.dateFlexibility = "Tell us how flexible your dates are.";

  const city = str(b.city, 80);
  if (!city) errors.city = "Enter the event city.";
  const state = str(b.state, 2)?.toUpperCase() ?? null;
  if (!state || !/^[A-Z]{2}$/.test(state)) errors.state = "Enter the two-letter state code.";

  const eventType = oneOf(b.eventType, EVENT_TYPES);
  if (!eventType) errors.eventType = "Choose the type of event.";
  const expectedAttendance = oneOf(b.expectedAttendance, ATTENDANCE);
  if (!expectedAttendance) errors.expectedAttendance = "Choose expected attendance, or “Not sure”.";
  const budget = oneOf(b.budget, BUDGET);
  if (!budget) errors.budget = "Choose a budget range, or “Not sure”.";
  const siteAccess = oneOf(b.siteAccess, SITE_ACCESS);
  if (!siteAccess) errors.siteAccess = "Choose site access, or “Not sure”.";
  const availableSpace = oneOf(b.availableSpace, SPACE);
  if (!availableSpace) errors.availableSpace = "Choose available space, or “Not sure”.";
  const power = oneOf(b.power, POWER);
  if (!power) errors.power = "Choose power availability, or “Not sure”.";

  const contactName = str(b.contactName, 120);
  if (!contactName) errors.contactName = "Enter your name.";
  const contactEmail = str(b.contactEmail, 200);
  if (!contactEmail || !EMAIL.test(contactEmail)) errors.contactEmail = "Enter a valid email address.";

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      idempotencyKey: idempotencyKey!,
      rideSlug,
      rideFlexibility: rideFlexibility!,
      dateStart: dateStart!,
      dateEnd,
      dateFlexibility: dateFlexibility!,
      city: city!,
      state: state!,
      venue: str(b.venue, 200),
      operatingHours: str(b.operatingHours, 120),
      eventType: eventType!,
      expectedAttendance: expectedAttendance!,
      budget: budget!,
      siteAccess: siteAccess!,
      availableSpace: availableSpace!,
      power: power!,
      notes: str(b.notes, 2000),
      contactName: contactName!,
      contactEmail: contactEmail!.toLowerCase(),
      contactPhone: str(b.contactPhone, 40),
      organization: str(b.organization, 160),
    },
  };
}
