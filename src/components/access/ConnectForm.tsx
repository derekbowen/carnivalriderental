import { RIDE_CLASSES } from "@/lib/catalog/operator-search";
import { RIDE_TYPES } from "@/lib/inventory";
import { rideTypeCopy } from "@/lib/inventory/ride-type-copy";
import { US_STATES } from "@/lib/taxonomy";

/** Short, honest event-type list for the request context (free text is not needed before payment). */
export const EVENT_TYPES: { id: string; label: string }[] = [
  { id: "school-carnival", label: "School carnival or fundraiser" },
  { id: "church-festival", label: "Church or community festival" },
  { id: "company-event", label: "Company picnic or employee event" },
  { id: "city-festival", label: "City festival, fair or street fair" },
  { id: "private-party", label: "Birthday, graduation or private party" },
  { id: "wedding", label: "Wedding or celebration" },
  { id: "grand-opening", label: "Grand opening or promotion" },
  { id: "other", label: "Something else" },
];

export interface ConnectPrefill {
  listingId?: string | null;
  rideType?: string | null;
  rideClass?: string | null;
  state?: string | null;
  city?: string | null;
  eventType?: string | null;
  sourcePath?: string | null;
}

/** Plain HTML form (no JS required) → POST /api/access/start. Fewer than ten fields before payment. */
export function ConnectForm({ prefill, today, error }: { prefill: ConnectPrefill; today: string; error?: string | null }) {
  const lockedType = prefill.listingId || prefill.rideType;
  return (
    <form method="post" action="/api/access/start" className="space-y-5" data-testid="connect-form">
      {error && (
        <p role="alert" className="rounded-lg border border-pop/40 bg-pop/10 px-4 py-3 text-sm">
          {error === "invalid" ? "Please check the highlighted fields." : error === "geocode" ? "We couldn't place that city. Check the spelling and state." : error === "expired" ? "That checkout session expired. Start again below." : "Event Access isn't available right now. Nothing was charged."}
        </p>
      )}
      {prefill.listingId && <input type="hidden" name="listingId" value={prefill.listingId} />}
      {prefill.rideType && <input type="hidden" name="rideType" value={prefill.rideType} />}
      {prefill.sourcePath && <input type="hidden" name="sourcePath" value={prefill.sourcePath} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="eventDate">Event date</label><input className="input" id="eventDate" name="eventDate" type="date" min={today} required /></div>
        <div><label className="label" htmlFor="eventType">Event type</label>
          <select className="input" id="eventType" name="eventType" defaultValue={prefill.eventType ?? ""}>
            <option value="">Choose (optional)</option>
            {EVENT_TYPES.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
        </div>
        <div><label className="label" htmlFor="city">Event city</label><input className="input" id="city" name="city" required maxLength={80} defaultValue={prefill.city ?? ""} autoComplete="address-level2" /></div>
        <div><label className="label" htmlFor="state">State</label>
          <select className="input" id="state" name="state" required defaultValue={prefill.state?.toUpperCase() ?? ""}>
            <option value="" disabled>Choose</option>
            {US_STATES.map((s) => <option key={s.abbr} value={s.abbr.toUpperCase()}>{s.name}</option>)}
          </select>
        </div>
        <div><label className="label" htmlFor="zip">ZIP (optional)</label><input className="input" id="zip" name="zip" inputMode="numeric" pattern="[0-9]{5}" autoComplete="postal-code" /></div>
        {!lockedType && (
          <div><label className="label" htmlFor="rideType">Ride type</label>
            <select className="input" id="rideType" name="rideType" defaultValue="">
              <option value="">Any ride type</option>
              {RIDE_TYPES.map((t) => <option key={t.id} value={t.id}>{rideTypeCopy(t.id, t.name).label}</option>)}
            </select>
          </div>
        )}
        {!lockedType && (
          <div><label className="label" htmlFor="rideClass">Or ride class</label>
            <select className="input" id="rideClass" name="rideClass" defaultValue={prefill.rideClass ?? ""}>
              <option value="">Any class</option>
              {RIDE_CLASSES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
        )}
        <div><label className="label" htmlFor="attendance">Expected attendance (optional)</label><input className="input" id="attendance" name="attendance" inputMode="numeric" min={0} type="number" /></div>
        <div><label className="label" htmlFor="budgetUsd">Rental budget, USD (optional)</label><input className="input" id="budgetUsd" name="budgetUsd" inputMode="numeric" min={0} type="number" /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="email">Your email</label><input className="input" id="email" name="email" type="email" required autoComplete="email" /><p className="mt-1 text-xs text-muted">Your pass link is sent here. No account or password.</p></div>
      </div>
      <button type="submit" className="btn-primary w-full sm:w-auto">See matching operators</button>
      <p className="text-xs text-muted">No payment on this step. Next you'll see how many contactable operators match before deciding.</p>
    </form>
  );
}
