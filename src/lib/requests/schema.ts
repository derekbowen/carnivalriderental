import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

/** Server-side validation for a submitted event brief. "Not sure" is always allowed for site questions. */
export const eventBriefSchema = z
  .object({
    rideSlug: z.string().regex(/^[a-z0-9-]+$/).max(80).nullable().optional().transform((v) => v ?? null),
    rideFlexibility: z.enum(["this_ride_only", "open_to_similar", "need_advice"]),
    eventDateStart: isoDate,
    eventDateEnd: isoDate.nullable().optional().transform((v) => v ?? null),
    dateFlexibility: z.enum(["fixed", "flexible"]),
    operatingHours: optionalText(200),
    city: z.string().trim().min(2).max(80),
    state: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Use a two-letter state code"),
    venueName: optionalText(160),
    eventType: z.enum(["corporate", "municipal", "school", "college", "festival", "private", "other"]),
    expectedAttendance: z.enum(["under_500", "500_2000", "2000_10000", "10000_plus", "not_sure"]),
    budget: z.enum(["under_10k", "10k_25k", "25k_50k", "50k_plus", "not_sure"]),
    siteSurface: z.enum(["paved", "grass", "mixed", "not_sure"]),
    availableSpace: optionalText(300),
    power: z.enum(["available", "not_available", "not_sure"]),
    siteAccess: optionalText(300),
    notes: optionalText(2000),
    contact: z.object({
      name: z.string().trim().min(2).max(120),
      email: z.string().trim().toLowerCase().email().max(200),
      phone: optionalText(40),
      organization: optionalText(160),
    }),
  })
  .superRefine((v, ctx) => {
    if (v.eventDateEnd && v.eventDateEnd < v.eventDateStart) {
      ctx.addIssue({ code: "custom", path: ["eventDateEnd"], message: "End date is before start date" });
    }
  });

export const createRequestSchema = z.object({
  idempotencyKey: z.string().uuid(),
  acknowledgedNotABooking: z.literal(true, {
    errorMap: () => ({ message: "Please confirm you understand this is a request, not a booking" }),
  }),
  brief: eventBriefSchema,
});

export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
