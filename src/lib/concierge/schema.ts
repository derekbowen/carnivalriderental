import { z } from "zod";
import { RIDE_TYPES } from "../inventory";
import { US_STATES } from "../taxonomy";

const text = (max: number) => z.string().trim().max(max).nullable();
export const leadSchema = z.object({
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => { const d = new Date(`${s}T00:00:00Z`); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s; }, "Invalid date").nullable(),
  city: text(80),
  state: z.string().refine(s => US_STATES.some(x => x.abbr.toUpperCase() === s)).nullable(),
  zip: z.string().regex(/^\d{5}$/).nullable(),
  eventType: text(60),
  attendance: z.number().int().min(0).max(1_000_000).nullable(),
  requestedRides: z.array(z.object({
    rideType: z.string().refine(s => RIDE_TYPES.some(t => t.id === s)),
    quantity: z.number().int().min(1).max(100).nullable(),
  })).max(12),
  budgetUsd: z.number().int().min(0).max(10_000_000).nullable(),
  setupConstraints: text(1500),
  contactName: text(100),
  email: z.string().email().max(200).nullable(),
  phone: text(40),
});
export type Lead = z.infer<typeof leadSchema>;
export const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("chat"), message: z.string().trim().min(1).max(3000), history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(3000) })).max(12).optional() }),
  z.object({ action: z.literal("save"), details: leadSchema }),
  z.object({ action: z.literal("search"), rideType: z.string().max(60).nullable() }),
  z.object({ action: z.literal("checkout"), rideType: z.string().max(60).nullable() }),
  z.object({ action: z.literal("availability"), listingId: z.string().uuid().nullable() }),
  z.object({ action: z.literal("unlock"), passId: z.string().uuid(), operatorId: z.string().regex(/^[A-Za-z0-9_-]{3,80}$/) }),
  z.object({ action: z.literal("status") }),
]);
