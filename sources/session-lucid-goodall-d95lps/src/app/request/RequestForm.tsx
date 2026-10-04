"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LABELS, label } from "@/lib/requests/options";

type Ride = { slug: string; name: string };
type Values = Record<string, string>;
type Errors = Record<string, string>;

const STEPS = ["Ride & flexibility", "Event details", "Site & budget", "Contact", "Review"] as const;
const DRAFT_KEY = "bac:request-draft";
const IDEMPOTENCY_KEY = "bac:request-key";

const STEP_FIELDS: string[][] = [
  ["rideSlug", "rideFlexibility"],
  ["dateStart", "dateEnd", "dateFlexibility", "city", "state", "venue", "operatingHours", "eventType", "expectedAttendance"],
  ["siteAccess", "availableSpace", "power", "budget", "notes"],
  ["contactName", "contactEmail", "contactPhone", "organization"],
];

function newKey() {
  return crypto.randomUUID();
}

function Select({ name, v, set, err, labelText }: { name: string; v: Values; set: (n: string, x: string) => void; err: Errors; labelText: string }) {
  return (
    <label className="block">
      <span className="field-label">{labelText}</span>
      <select className="field" value={v[name] ?? ""} onChange={(e) => set(name, e.target.value)} aria-invalid={Boolean(err[name])}>
        <option value="">Choose…</option>
        {Object.entries(LABELS[name]).map(([k, l]) => (
          <option key={k} value={k}>{l}</option>
        ))}
      </select>
      {err[name] ? <span className="mt-1 block text-xs text-red-700">{err[name]}</span> : null}
    </label>
  );
}

function Text({ name, v, set, err, labelText, type = "text", optional, placeholder }: { name: string; v: Values; set: (n: string, x: string) => void; err: Errors; labelText: string; type?: string; optional?: boolean; placeholder?: string }) {
  return (
    <label className="block">
      <span className="field-label">
        {labelText} {optional ? <span className="font-normal text-ink-muted">(optional)</span> : null}
      </span>
      <input className="field" type={type} value={v[name] ?? ""} placeholder={placeholder} onChange={(e) => set(name, e.target.value)} aria-invalid={Boolean(err[name])} />
      {err[name] ? <span className="mt-1 block text-xs text-red-700">{err[name]}</span> : null}
    </label>
  );
}

export function RequestForm({ rides, initial, browseHref }: { rides: Ride[]; initial: Values; browseHref: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [v, setV] = useState<Values>({ rideFlexibility: initial.rideSlug ? "similar_rides_ok" : "open_to_suggestions", dateFlexibility: "fixed", ...initial });
  const [err, setErr] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  // Restore an unsent draft (per-browser convenience only).
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (saved) setV((cur) => ({ ...JSON.parse(saved), ...Object.fromEntries(Object.entries(initial).filter(([, x]) => x)), ...cur }));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(v)); } catch {}
  }, [v]);

  const set = (n: string, x: string) => {
    setV((cur) => ({ ...cur, [n]: x }));
    setErr((cur) => ({ ...cur, [n]: "" }));
  };

  const rideName = useMemo(() => rides.find((r) => r.slug === v.rideSlug)?.name ?? "Not chosen — suggest one", [rides, v.rideSlug]);

  function localCheck(i: number): Errors {
    const e: Errors = {};
    const req = (k: string, m: string) => { if (!v[k]?.trim()) e[k] = m; };
    if (i === 0) {
      req("rideFlexibility", "Tell us how flexible you are.");
      if (!v.rideSlug && v.rideFlexibility === "this_ride_only") e.rideFlexibility = "Pick a ride, or let us suggest one.";
    }
    if (i === 1) {
      req("dateStart", "Enter your event date."); req("dateFlexibility", "Choose one."); req("city", "Enter the city.");
      if (!/^[A-Za-z]{2}$/.test(v.state ?? "")) e.state = "Two-letter state code.";
      req("eventType", "Choose the event type."); req("expectedAttendance", "Choose one, or “Not sure”.");
    }
    if (i === 2) { req("siteAccess", "Choose one, or “Not sure”."); req("availableSpace", "Choose one, or “Not sure”."); req("power", "Choose one, or “Not sure”."); req("budget", "Choose one, or “Not sure yet”."); }
    if (i === 3) { req("contactName", "Enter your name."); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.contactEmail ?? "")) e.contactEmail = "Enter a valid email."; }
    return e;
  }

  function next() {
    const e = localCheck(step);
    if (Object.keys(e).length) return setErr(e);
    setStep((s) => Math.min(s + 1, 4));
  }

  async function submit() {
    setSubmitting(true);
    setFailure(null);
    // The same key is reused for every retry of this draft, so a repeated or
    // double-clicked submission cannot create a second request.
    let key = "";
    try { key = sessionStorage.getItem(IDEMPOTENCY_KEY) || ""; } catch {}
    if (!key) { key = newKey(); try { sessionStorage.setItem(IDEMPOTENCY_KEY, key); } catch {} }
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...v, rideSlug: v.rideSlug || null, idempotencyKey: key }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 201 || res.status === 200) {
        if (typeof body.statusUrl !== "string") throw new Error("missing status link");
        try { sessionStorage.removeItem(DRAFT_KEY); sessionStorage.removeItem(IDEMPOTENCY_KEY); } catch {}
        router.push(`${body.statusUrl}&submitted=1`);
        return;
      }
      if (res.status === 422 && body.fields) {
        setErr(body.fields);
        const first = STEP_FIELDS.findIndex((fs) => fs.some((f) => body.fields[f]));
        if (first >= 0) setStep(first);
        setFailure("Some details need fixing before we can save your request.");
      } else {
        setFailure(body.message || "Your request was not saved. Please try again.");
      }
    } catch {
      setFailure("Your request was not saved — we couldn't reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr]">
      <ol className="flex gap-2 overflow-x-auto lg:flex-col" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s} className={`whitespace-nowrap rounded-md px-3 py-2 text-sm ${i === step ? "bg-ink text-white" : i < step ? "text-ink" : "text-ink-muted"}`}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      <div className="card p-6 sm:p-8">
        {step === 0 ? (
          <div className="grid gap-5">
            <label className="block">
              <span className="field-label">Which ride?</span>
              <select className="field" value={v.rideSlug ?? ""} onChange={(e) => set("rideSlug", e.target.value)}>
                <option value="">Not sure — suggest one</option>
                {rides.map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}
              </select>
              {err.rideSlug ? <span className="mt-1 block text-xs text-red-700">{err.rideSlug}</span> : null}
              <span className="mt-1 block text-xs text-ink-muted">Need ideas? <a className="underline" href={browseHref}>Browse rides</a>.</span>
            </label>
            <Select name="rideFlexibility" v={v} set={set} err={err} labelText="How flexible are you on the ride?" />
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <Text name="dateStart" type="date" v={v} set={set} err={err} labelText="Event date (or first day)" />
            <Text name="dateEnd" type="date" v={v} set={set} err={err} labelText="Last day" optional />
            <Select name="dateFlexibility" v={v} set={set} err={err} labelText="Date flexibility" />
            <Select name="eventType" v={v} set={set} err={err} labelText="Event type" />
            <Text name="city" v={v} set={set} err={err} labelText="City" />
            <Text name="state" v={v} set={(n, x) => set(n, x.toUpperCase().slice(0, 2))} err={err} labelText="State" placeholder="TX" />
            <Text name="venue" v={v} set={set} err={err} labelText="Venue or address" optional />
            <Text name="operatingHours" v={v} set={set} err={err} labelText="Operating hours" optional placeholder="e.g. 10am–8pm" />
            <Select name="expectedAttendance" v={v} set={set} err={err} labelText="Expected attendance" />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <p className="text-sm text-ink-muted sm:col-span-2">“Not sure” is fine — the operator confirms site needs during sourcing.</p>
            <Select name="siteAccess" v={v} set={set} err={err} labelText="Site access for trucks" />
            <Select name="availableSpace" v={v} set={set} err={err} labelText="Space available for the ride" />
            <Select name="power" v={v} set={set} err={err} labelText="Power" />
            <Select name="budget" v={v} set={set} err={err} labelText="Budget" />
            <label className="block sm:col-span-2">
              <span className="field-label">Anything else? <span className="font-normal text-ink-muted">(optional)</span></span>
              <textarea className="field min-h-24" value={v.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
            </label>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <Text name="contactName" v={v} set={set} err={err} labelText="Your name" />
            <Text name="contactEmail" type="email" v={v} set={set} err={err} labelText="Email" />
            <Text name="contactPhone" type="tel" v={v} set={set} err={err} labelText="Phone" optional />
            <Text name="organization" v={v} set={set} err={err} labelText="Organization" optional />
          </div>
        ) : null}

        {step === 4 ? (
          <div>
            <h2 className="font-display text-2xl">Review your request</h2>
            <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {[
                ["Ride", rideName],
                ["Ride flexibility", label("rideFlexibility", v.rideFlexibility)],
                ["Dates", `${v.dateStart}${v.dateEnd ? ` to ${v.dateEnd}` : ""} · ${label("dateFlexibility", v.dateFlexibility)}`],
                ["Location", `${v.city}, ${v.state}${v.venue ? ` · ${v.venue}` : ""}`],
                ["Event", `${label("eventType", v.eventType)} · ${label("expectedAttendance", v.expectedAttendance)} attending`],
                ["Hours", v.operatingHours || "—"],
                ["Site", `${label("siteAccess", v.siteAccess)} · ${label("availableSpace", v.availableSpace)} · ${label("power", v.power)}`],
                ["Budget", label("budget", v.budget)],
                ["Contact", `${v.contactName} · ${v.contactEmail}${v.contactPhone ? ` · ${v.contactPhone}` : ""}`],
              ].map(([k, val]) => (
                <div key={k}>
                  <dt className="text-ink-muted">{k}</dt>
                  <dd className="font-medium">{val}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 rounded-md bg-marquee-soft/60 p-3 text-sm">
              Submitting sends your brief to our team. It is <strong>not a booking</strong> and takes no payment. You&apos;ll
              get a written quote after we source an operator.
            </p>
          </div>
        ) : null}

        {failure ? <p role="alert" className="mt-6 rounded-md bg-red-50 p-3 text-sm text-red-800">{failure}</p> : null}

        <div className="mt-8 flex items-center justify-between">
          <button type="button" className="btn-secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || submitting}>
            Back
          </button>
          {step < 4 ? (
            <button type="button" className="btn-primary" onClick={next}>Continue</button>
          ) : (
            <button type="button" className="btn-primary" onClick={submit} disabled={submitting}>
              {submitting ? "Sending…" : "Submit request"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
