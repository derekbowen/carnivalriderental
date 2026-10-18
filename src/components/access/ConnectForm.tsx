import { RIDE_CLASSES } from "@/lib/catalog/operator-search";
import { RIDE_TYPES } from "@/lib/inventory";
import { rideTypeCopy } from "@/lib/inventory/ride-type-copy";
import { US_STATES } from "@/lib/taxonomy";
import { PriceHint } from "./PriceHint";
import { ProtectedForm } from "@/components/access/ProtectedForm";

export { EVENT_TYPES } from "@/lib/access/event-types";

/** "Kiddie ride" → "kiddie ride", "Spectacular" → "spectacular ride", for "Any …" options. */
const classNoun = (label: string) => (/(ride|coaster|attraction|walk-through)$/i.test(label) ? label : `${label} ride`).toLowerCase();

export interface ConnectPrefill {
  listingId?: string | null;
  rideType?: string | null;
  rideClass?: string | null;
  state?: string | null;
  city?: string | null;
  eventType?: string | null;
  sourcePath?: string | null;
}

/** Formatted prices of both tiers for the selector hint (display only; the server resolves the tier it charges). */
export interface ConnectPricing {
  standard: string | null;
  ferris: string | null;
  ferrisTypes: string[];
}

/**
 * Event form → POST /api/access/start (fetch via ProtectedForm for BotID; still posts natively without
 * JS). Founder 2026-10-18: only what matching and the pass need. The ride (one select: a ride type, or
 * "class:<id>" for a whole category, mapped by the start route; hidden when the page already chose
 * it), city and state, the date and an email. Event type, ZIP, attendance and budget stay optional on
 * the server and are no longer asked for; an occasion page still passes its event type along.
 */
export function ConnectForm({ prefill, today, error, pricing }: { prefill: ConnectPrefill; today: string; error?: string | null; pricing?: ConnectPricing | null }) {
  const lockedType = prefill.listingId || prefill.rideType;
  return (
    <ProtectedForm action="/api/access/start" className="space-y-5" testId="connect-form">
      {error && (
        <p role="alert" className="rounded-lg border border-pop/40 bg-pop/10 px-4 py-3 text-sm">
          {error === "invalid" ? "Please check the highlighted fields." : error === "geocode" ? "We couldn't place that city. Check the spelling and state." : error === "expired" ? "That checkout session expired. Start again below." : "Event Access isn't available right now. Nothing was charged."}
        </p>
      )}
      {prefill.listingId && <input type="hidden" name="listingId" value={prefill.listingId} />}
      {prefill.rideType && <input type="hidden" name="rideType" value={prefill.rideType} />}
      {prefill.eventType && <input type="hidden" name="eventType" value={prefill.eventType} />}
      {prefill.sourcePath && <input type="hidden" name="sourcePath" value={prefill.sourcePath} />}
      <div className="grid gap-4 sm:grid-cols-2">
        {!lockedType && (
          <div className="sm:col-span-2"><label className="label" htmlFor="rideType">What ride?</label>
            <select className="input" id="rideType" name="ride" defaultValue={prefill.rideClass ? `class:${prefill.rideClass}` : ""}>
              <option value="">Any carnival ride</option>
              <optgroup label="Kinds of rides">
                {RIDE_CLASSES.map((c) => <option key={c.id} value={`class:${c.id}`}>Any {classNoun(c.label)}</option>)}
              </optgroup>
              <optgroup label="Specific rides">
                {RIDE_TYPES.map((t) => <option key={t.id} value={t.id}>{rideTypeCopy(t.id, t.name).label}</option>)}
              </optgroup>
            </select>
            {pricing && <PriceHint standard={pricing.standard} ferris={pricing.ferris} ferrisTypes={pricing.ferrisTypes} />}
          </div>
        )}
        <div><label className="label" htmlFor="city">Event city</label><input className="input" id="city" name="city" required maxLength={80} defaultValue={prefill.city ?? ""} autoComplete="address-level2" /></div>
        <div><label className="label" htmlFor="state">State</label>
          <select className="input" id="state" name="state" required defaultValue={prefill.state?.toUpperCase() ?? ""}>
            <option value="" disabled>Choose</option>
            {US_STATES.map((s) => <option key={s.abbr} value={s.abbr.toUpperCase()}>{s.name}</option>)}
          </select>
        </div>
        <div><label className="label" htmlFor="eventDate">Event date</label><input className="input" id="eventDate" name="eventDate" type="date" min={today} required /></div>
        <div><label className="label" htmlFor="email">Your email</label><input className="input" id="email" name="email" type="email" required autoComplete="email" /><p className="mt-1 text-xs text-muted">We send your matches and pass link here. No account or password.</p></div>
      </div>
      <button type="submit" className="btn-primary w-full sm:w-auto">See matching operators</button>
      <p className="text-xs text-muted">Free, no payment on this step. Next you&rsquo;ll see how many operators match before deciding anything.</p>
    </ProtectedForm>
  );
}
