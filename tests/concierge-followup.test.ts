import { describe, it, expect, vi } from "vitest";
import { startEventRequest, createCheckout, activateFromSession } from "@/lib/access/service";
import { fixtureSource } from "@/lib/access/contacts";
import { fakeStripe } from "@/lib/access/stripe";
import { memoryAccessDb } from "@/lib/access/db";
import { conversation } from "@/lib/concierge/service";
import { consentToFollowup, eligibleForFollowup, unsubscribe, dispatchFollowups } from "@/lib/concierge/followup";
describe("Consented follow-ups", () => {
  it("schedules only on explicit capture, deduplicates and cancels on unsubscribe", async () => {
    const db = memoryAccessDb(); const { session } = await conversation(db);
    expect(await eligibleForFollowup(db, session.id)).toBe(false);
    await consentToFollowup(db, session.id, "buyer@example.com");
    await consentToFollowup(db, session.id, "buyer@example.com");
    expect(await db.query(`SELECT * FROM concierge_followup_jobs`)).toHaveLength(3);
    expect(await eligibleForFollowup(db, session.id)).toBe(true);
    const c = (await db.query(`SELECT resume_token FROM concierge_followup_consent`))[0];
    await unsubscribe(db, String(c.resume_token));
    expect(await eligibleForFollowup(db, session.id)).toBe(false);
    expect(await db.query(`SELECT * FROM concierge_followup_jobs WHERE status = 'pending'`)).toHaveLength(0);
  });
  it("suppresses reminders when the same email purchases in another conversation", async () => {
    const db = memoryAccessDb(); const { session } = await conversation(db);
    await consentToFollowup(db, session.id, "buyer@example.com");
    const source = fixtureSource(), stripe = fakeStripe("http://localhost");
    const { event } = await startEventRequest(db, source, { email: "buyer@example.com", eventDate: "2030-06-15", city: "Columbus", state: "OH", rideType: "carousel" });
    const { purchase } = await createCheckout(db, stripe, event.id, "http://localhost");
    stripe.complete(purchase.stripeCheckoutSessionId!, "paid");
    await activateFromSession(db, stripe, purchase.id, purchase.stripeCheckoutSessionId!, "http://localhost");
    expect(await eligibleForFollowup(db, session.id)).toBe(false);
    expect(await db.query(`SELECT * FROM concierge_followup_jobs WHERE status = 'pending'`)).toHaveLength(0);
  });
  it("never sends while disabled", async () => {
    vi.stubEnv("CONCIERGE_FOLLOWUPS_ENABLED", "false");
    expect(await dispatchFollowups(memoryAccessDb(), "http://localhost")).toEqual({ sent: 0, disabled: true });
    vi.unstubAllEnvs();
  });
});
