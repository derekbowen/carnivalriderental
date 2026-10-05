"use client";

import { useRef, useState } from "react";
import { authenticate, findDuplicate, sendInquiry, sha256Hex, StError } from "@/lib/sharetribe/browser";

export interface RideRequestTarget {
  /** Listing the inquiry is sent on: the ride itself (claimed operator) or the request desk. */
  listingId: string;
  processAlias: string;
  toDesk: boolean;
  ride: { id: string; title: string };
}

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "done"; txId: string; duplicate: boolean } | { kind: "error"; message: string; code?: string };

const US = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

/**
 * Event request for one operator ride. Creates a Sharetribe inquiry transaction (no payment) from
 * the customer's own account, so the request is saved in the marketplace and visible in both
 * inboxes. Success is shown only after the transaction AND its first message are saved.
 */
export function RideRequestForm({ target, clientId, marketplaceUrl, today }: { target: RideRequestTarget; clientId: string; marketplaceUrl: string; today: string }) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const busy = useRef(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy.current) return; // double-click / double-submit guard
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? "").trim();
    const eventDate = v("eventDate");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || eventDate < today) return setStatus({ kind: "error", message: "Pick an event date from today onwards." });
    busy.current = true;
    setStatus({ kind: "sending" });
    try {
      const email = v("email").toLowerCase();
      const userToken = await authenticate(clientId, { mode, email, password: String(f.get("password") ?? ""), firstName: v("firstName"), lastName: v("lastName"), phone: v("phone") });
      const requestKey = await sha256Hex([target.listingId, target.ride.id, eventDate, email].join("|"));
      const existing = await findDuplicate(userToken, requestKey);
      if (existing) {
        setStatus({ kind: "done", txId: existing, duplicate: true });
        return;
      }
      const pd = {
        requestKey,
        source: "carnivalriderental.us",
        rideListingId: target.ride.id,
        rideTitle: target.ride.title,
        eventDate,
        startTime: v("startTime"),
        endTime: v("endTime"),
        eventAddress: v("address"),
        eventCity: v("city"),
        eventState: v("state"),
        eventZip: v("zip"),
        guests: v("guests"),
        contactName: `${v("firstName")} ${v("lastName")}`.trim(),
        contactPhone: v("phone"),
        notes: v("notes"),
      };
      const message = [
        `Ride request: ${target.ride.title}`,
        `Event date: ${eventDate}${pd.startTime ? `, ${pd.startTime}${pd.endTime ? `–${pd.endTime}` : ""}` : ""}`,
        `Event location: ${[pd.eventAddress, pd.eventCity, pd.eventState, pd.eventZip].filter(Boolean).join(", ")}`,
        pd.guests ? `Expected guests: ${pd.guests}` : null,
        `Contact: ${pd.contactName}${pd.contactPhone ? `, ${pd.contactPhone}` : ""}`,
        pd.notes ? `Notes: ${pd.notes}` : null,
        target.ride.id ? `Ride listing: ${target.ride.id}` : null,
      ].filter(Boolean).join("\n");
      const txId = await sendInquiry(userToken, target.listingId, target.processAlias, pd, message);
      setStatus({ kind: "done", txId, duplicate: false });
    } catch (err) {
      const se = err instanceof StError ? err : null;
      setStatus({ kind: "error", code: se?.code, message: se ? se.message : "We couldn't reach the marketplace. Nothing was sent; please try again." });
    } finally {
      busy.current = false;
    }
  }

  if (status.kind === "done") {
    return (
      <div role="status" data-testid="request-sent" className="card p-6">
        <h2 className="text-2xl">{status.duplicate ? "You already sent this request" : "Request sent"}</h2>
        <p className="mt-2 text-ink-soft">
          {target.toDesk
            ? "Saved in the Carnival Ride Rental request desk. The ride's operator has not joined yet and has not received it; our team will contact them and reply in your inbox."
            : "Saved and sent to the ride's operator. They reply in your inbox. This is a request, not a booking."}
        </p>
        <p className="mt-2 text-sm text-muted">Reference: {status.txId}</p>
        <a className="btn-primary mt-4" href={`${marketplaceUrl}/order/${status.txId}`}>Open your inbox</a>
      </div>
    );
  }

  const sending = status.kind === "sending";
  return (
    <form onSubmit={onSubmit} className="space-y-5" data-testid="ride-request-form">
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-lg font-semibold">Your event</legend>
        <div><label className="label" htmlFor="eventDate">Event date</label><input className="input" id="eventDate" name="eventDate" type="date" min={today} required /></div>
        <div><label className="label" htmlFor="startTime">Start time</label><input className="input" id="startTime" name="startTime" type="time" /></div>
        <div><label className="label" htmlFor="endTime">End time</label><input className="input" id="endTime" name="endTime" type="time" /></div>
        <div className="sm:col-span-3"><label className="label" htmlFor="address">Event address</label><input className="input" id="address" name="address" autoComplete="street-address" /></div>
        <div><label className="label" htmlFor="city">City</label><input className="input" id="city" name="city" required autoComplete="address-level2" /></div>
        <div><label className="label" htmlFor="state">State</label><select className="input" id="state" name="state" required defaultValue=""><option value="" disabled>Choose</option>{US.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div><label className="label" htmlFor="zip">ZIP</label><input className="input" id="zip" name="zip" inputMode="numeric" pattern="[0-9]{5}" autoComplete="postal-code" /></div>
        <div><label className="label" htmlFor="guests">Expected guests</label><input className="input" id="guests" name="guests" inputMode="numeric" /></div>
        <div className="sm:col-span-3"><label className="label" htmlFor="notes">Anything else (site surface, power, access)</label><textarea className="input" id="notes" name="notes" rows={3} maxLength={2000} /></div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-lg font-semibold">Your marketplace account</legend>
        <div className="sm:col-span-2 flex gap-2" role="radiogroup" aria-label="Account">
          <button type="button" className={mode === "signup" ? "btn-dark" : "btn-ghost"} onClick={() => setMode("signup")} aria-pressed={mode === "signup"}>I&rsquo;m new</button>
          <button type="button" className={mode === "login" ? "btn-dark" : "btn-ghost"} onClick={() => setMode("login")} aria-pressed={mode === "login"}>I have an account</button>
        </div>
        {mode === "signup" && (
          <>
            <div><label className="label" htmlFor="firstName">First name</label><input className="input" id="firstName" name="firstName" required autoComplete="given-name" /></div>
            <div><label className="label" htmlFor="lastName">Last name</label><input className="input" id="lastName" name="lastName" required autoComplete="family-name" /></div>
            <div><label className="label" htmlFor="phone">Phone</label><input className="input" id="phone" name="phone" type="tel" required autoComplete="tel" /></div>
          </>
        )}
        <div><label className="label" htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" required autoComplete="email" /></div>
        <div><label className="label" htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} /></div>
        <p className="sm:col-span-2 text-xs text-muted">Your account is created on the Carnival Ride Rental marketplace (powered by Sharetribe), where you&rsquo;ll see replies. Your password goes directly to the marketplace.</p>
      </fieldset>

      {status.kind === "error" && (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {status.message}
          {status.code === "email-taken" && <button type="button" className="ml-2 underline" onClick={() => { setMode("login"); setStatus({ kind: "idle" }); }}>Log in</button>}
        </p>
      )}
      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={sending}>{sending ? "Sending…" : "Send request"}</button>
      <p className="text-xs text-muted">No payment is taken to send a request. It is a request, not a booking.</p>
    </form>
  );
}
