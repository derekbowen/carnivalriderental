"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { OPTION_LABELS } from "@/lib/requests/labels";
import { interpretCreateResponse } from "@/lib/requests/submit";

type RideOption = { slug: string; name: string };
type Prefill = { rideSlug?: string; city?: string; state?: string; date?: string };

const STEPS = ["Ride & dates", "Location & venue", "Site details", "Contact & budget", "Review"] as const;
const DRAFT_KEY = "bac:request-draft";
const KEY_KEY = "bac:request-idempotency-key";

interface FormState {
  rideSlug: string; // "" = not sure / need advice
  rideFlexibility: "this_ride_only" | "open_to_similar" | "need_advice";
  eventDateStart: string;
  eventDateEnd: string;
  dateFlexibility: "fixed" | "flexible";
  operatingHours: string;
  city: string;
  state: string;
  venueName: string;
  eventType: keyof typeof OPTION_LABELS.eventType | "";
  expectedAttendance: keyof typeof OPTION_LABELS.expectedAttendance;
  budget: keyof typeof OPTION_LABELS.budget;
  siteSurface: keyof typeof OPTION_LABELS.siteSurface;
  availableSpace: string;
  power: keyof typeof OPTION_LABELS.power;
  siteAccess: string;
  notes: string;
  name: string;
  email: string;
  phone: string;
  organization: string;
  acknowledged: boolean;
}

const initial = (p: Prefill): FormState => ({
  rideSlug: p.rideSlug ?? "",
  rideFlexibility: p.rideSlug ? "open_to_similar" : "need_advice",
  eventDateStart: p.date ?? "",
  eventDateEnd: "",
  dateFlexibility: "fixed",
  operatingHours: "",
  city: p.city ?? "",
  state: p.state ?? "",
  venueName: "",
  eventType: "",
  expectedAttendance: "not_sure",
  budget: "not_sure",
  siteSurface: "not_sure",
  availableSpace: "",
  power: "not_sure",
  siteAccess: "",
  notes: "",
  name: "",
  email: "",
  phone: "",
  organization: "",
  acknowledged: false,
});

function stepErrors(step: number, f: FormState, today: string): string[] {
  const e: string[] = [];
  if (step === 0) {
    if (!f.eventDateStart) e.push("Choose an event date (an approximate date is fine — mark it flexible).");
    else if (f.eventDateStart < today) e.push("Event date must be in the future.");
    if (f.eventDateEnd && f.eventDateEnd < f.eventDateStart) e.push("End date is before the start date.");
  }
  if (step === 1) {
    if (f.city.trim().length < 2) e.push("Enter the event city.");
    if (!/^[A-Za-z]{2}$/.test(f.state.trim())) e.push("Enter a two-letter state code, e.g. TX.");
    if (!f.eventType) e.push("Choose an event type.");
  }
  if (step === 3) {
    if (f.name.trim().length < 2) e.push("Enter your name.");
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.push("Enter a valid email address.");
  }
  if (step === 4 && !f.acknowledged) e.push("Please confirm you understand this is a request, not a booking.");
  return e;
}

function toPayload(f: FormState, idempotencyKey: string) {
  const t = (s: string) => (s.trim() ? s.trim() : null);
  return {
    idempotencyKey,
    acknowledgedNotABooking: f.acknowledged,
    brief: {
      rideSlug: f.rideSlug || null,
      rideFlexibility: f.rideSlug ? f.rideFlexibility : "need_advice",
      eventDateStart: f.eventDateStart,
      eventDateEnd: t(f.eventDateEnd),
      dateFlexibility: f.dateFlexibility,
      operatingHours: t(f.operatingHours),
      city: f.city.trim(),
      state: f.state.trim().toUpperCase(),
      venueName: t(f.venueName),
      eventType: f.eventType,
      expectedAttendance: f.expectedAttendance,
      budget: f.budget,
      siteSurface: f.siteSurface,
      availableSpace: t(f.availableSpace),
      power: f.power,
      siteAccess: t(f.siteAccess),
      notes: t(f.notes),
      contact: { name: f.name.trim(), email: f.email.trim(), phone: t(f.phone), organization: t(f.organization) },
    },
  };
}

function Choice<T extends string>({ name, value, options, onChange }: { name: string; value: T; options: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={name} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {(Object.keys(options) as T[]).map((k) => {
        const selected = value === k;
        const unsure = k === "not_sure" || k === "need_advice";
        return (
          <label
            key={k}
            className={`flex cursor-pointer items-center gap-2.5 rounded-lg border bg-surface px-3.5 py-3 text-[15px] transition-[border-color] duration-150 ${selected ? "border-ink text-ink shadow-[inset_0_0_0_1px_#0B1B3F]" : "border-line-strong text-ink-soft hover:border-muted"} ${unsure && !selected ? "border-dashed" : ""}`}
          >
            <input type="radio" name={name} value={k} checked={selected} onChange={() => onChange(k)} className="h-4 w-4 accent-ink" />
            <span className="flex-1">{options[k]}</span>
          </label>
        );
      })}
    </div>
  );
}

export function EventRequestForm({ rides, prefill }: { rides: RideOption[]; prefill: Prefill }) {
  const router = useRouter();
  const [f, setF] = useState<FormState>(() => initial(prefill));
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const keyRef = useRef<string>("");
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Restore an unsent draft and its idempotency key (so a retry after a network error can't duplicate).
  useEffect(() => {
    try {
      const draft = sessionStorage.getItem(DRAFT_KEY);
      if (draft && !prefill.rideSlug && !prefill.city) setF({ ...initial(prefill), ...JSON.parse(draft), acknowledged: false });
      keyRef.current = sessionStorage.getItem(KEY_KEY) || crypto.randomUUID();
      sessionStorage.setItem(KEY_KEY, keyRef.current);
    } catch {
      keyRef.current = keyRef.current || crypto.randomUUID();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(f));
    } catch {}
  }, [f]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  function next() {
    const e = stepErrors(step, f, today);
    setErrors(e);
    if (e.length === 0) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function submit() {
    if (submitting) return;
    const e = [0, 1, 3, 4].flatMap((s) => stepErrors(s, f, today));
    setErrors(e);
    if (e.length) return;
    setSubmitting(true);
    setSubmitError(null);
    let status = 0;
    let body: unknown = null;
    try {
      const res = await fetch("/api/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toPayload(f, keyRef.current)) });
      status = res.status;
      body = await res.json().catch(() => null);
    } catch {
      // network failure: status stays 0
    }
    const outcome = interpretCreateResponse(status, body);
    if (!outcome.ok) {
      setSubmitError(outcome.message);
      setSubmitting(false);
      return;
    }
    try {
      sessionStorage.removeItem(DRAFT_KEY);
      sessionStorage.removeItem(KEY_KEY);
    } catch {}
    // The status page reads the persisted record from the server; it is the confirmation.
    router.push(`${outcome.statusUrl}&new=1`);
  }

  const rideName = rides.find((r) => r.slug === f.rideSlug)?.name ?? "Not sure — need advice";

  return (
    <div className="rounded-2xl border border-line bg-surface p-6 shadow-[0_12px_32px_-20px_rgba(20,33,61,0.25)] sm:p-8">
      <ol className="mb-8 grid grid-cols-5 gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className="text-center">
            <div className={`h-1 rounded-full ${i <= step ? "bg-ink" : "bg-line-strong"}`} />
            <div className={`mt-2 hidden text-xs sm:block ${i === step ? "font-semibold text-ink" : "text-muted"}`}>{s}</div>
          </li>
        ))}
      </ol>
      <h2 className="text-2xl">{STEPS[step]}</h2>

      <div className="mt-6 space-y-6">
        {step === 0 && (
          <>
            <label className="block">
              <span className="label">Which ride are you interested in?</span>
              <select className="input" value={f.rideSlug} onChange={(e) => set("rideSlug", e.target.value)}>
                <option value="">Not sure — I need advice</option>
                {rides.map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}
              </select>
            </label>
            {f.rideSlug && (
              <div>
                <span className="label">Flexibility on ride choice</span>
                <Choice name="rideFlexibility" value={f.rideFlexibility} options={OPTION_LABELS.rideFlexibility} onChange={(v) => set("rideFlexibility", v)} />
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="label">Event start date</span><input type="date" min={today} className="input" value={f.eventDateStart} onChange={(e) => set("eventDateStart", e.target.value)} /></label>
              <label className="block"><span className="label">End date <span className="font-normal text-muted">(optional)</span></span><input type="date" min={f.eventDateStart || today} className="input" value={f.eventDateEnd} onChange={(e) => set("eventDateEnd", e.target.value)} /></label>
            </div>
            <div><span className="label">Date flexibility</span><Choice name="dateFlexibility" value={f.dateFlexibility} options={OPTION_LABELS.dateFlexibility} onChange={(v) => set("dateFlexibility", v)} /></div>
            <label className="block"><span className="label">Operating hours <span className="font-normal text-muted">(optional)</span></span><input className="input" placeholder="e.g. 11am–9pm each day" value={f.operatingHours} onChange={(e) => set("operatingHours", e.target.value)} /></label>
          </>
        )}

        {step === 1 && (
          <>
            <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
              <label className="block"><span className="label">City</span><input className="input" value={f.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" /></label>
              <label className="block"><span className="label">State</span><input className="input uppercase" maxLength={2} placeholder="TX" value={f.state} onChange={(e) => set("state", e.target.value)} /></label>
            </div>
            <label className="block"><span className="label">Venue name <span className="font-normal text-muted">(optional)</span></span><input className="input" value={f.venueName} onChange={(e) => set("venueName", e.target.value)} /></label>
            <div><span className="label">Event type</span><Choice name="eventType" value={f.eventType as keyof typeof OPTION_LABELS.eventType} options={OPTION_LABELS.eventType} onChange={(v) => set("eventType", v)} /></div>
            <div><span className="label">Expected attendance</span><Choice name="expectedAttendance" value={f.expectedAttendance} options={OPTION_LABELS.expectedAttendance} onChange={(v) => set("expectedAttendance", v)} /></div>
          </>
        )}

        {step === 2 && (
          <>
            <p className="rounded-xl bg-canvas p-4 text-sm text-ink-soft">Answer what you know. “Not sure” is fine — the operator confirms site fit before we quote. Please don’t guess measurements.</p>
            <div><span className="label">Ground surface</span><Choice name="siteSurface" value={f.siteSurface} options={OPTION_LABELS.siteSurface} onChange={(v) => set("siteSurface", v)} /></div>
            <div><span className="label">Power</span><Choice name="power" value={f.power} options={OPTION_LABELS.power} onChange={(v) => set("power", v)} /></div>
            <label className="block"><span className="label">Available space <span className="font-normal text-muted">(leave blank if not sure)</span></span><input className="input" placeholder="e.g. a 100×100 ft parking lot" value={f.availableSpace} onChange={(e) => set("availableSpace", e.target.value)} /></label>
            <label className="block"><span className="label">Site access for trucks <span className="font-normal text-muted">(leave blank if not sure)</span></span><input className="input" placeholder="e.g. wide gate off main road" value={f.siteAccess} onChange={(e) => set("siteAccess", e.target.value)} /></label>
          </>
        )}

        {step === 3 && (
          <>
            <div><span className="label">Approximate budget for rides</span><Choice name="budget" value={f.budget} options={OPTION_LABELS.budget} onChange={(v) => set("budget", v)} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="label">Your name</span><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" /></label>
              <label className="block"><span className="label">Email</span><input type="email" className="input" value={f.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" /></label>
              <label className="block"><span className="label">Phone <span className="font-normal text-muted">(optional)</span></span><input type="tel" className="input" value={f.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" /></label>
              <label className="block"><span className="label">Organization <span className="font-normal text-muted">(optional)</span></span><input className="input" value={f.organization} onChange={(e) => set("organization", e.target.value)} autoComplete="organization" /></label>
            </div>
            <label className="block"><span className="label">Anything else? <span className="font-normal text-muted">(optional)</span></span><textarea rows={4} className="input" value={f.notes} onChange={(e) => set("notes", e.target.value)} /></label>
          </>
        )}

        {step === 4 && (
          <>
            <dl className="divide-y divide-line rounded-xl border border-line text-sm">
              {[
                ["Ride", rideName],
                ["Dates", `${f.eventDateStart}${f.eventDateEnd ? ` → ${f.eventDateEnd}` : ""} · ${OPTION_LABELS.dateFlexibility[f.dateFlexibility]}`],
                ["Operating hours", f.operatingHours || "Not specified"],
                ["Location", `${f.venueName ? f.venueName + ", " : ""}${f.city}, ${f.state.toUpperCase()}`],
                ["Event", `${f.eventType ? OPTION_LABELS.eventType[f.eventType] : ""} · ${OPTION_LABELS.expectedAttendance[f.expectedAttendance]} attendees`],
                ["Site", `${OPTION_LABELS.siteSurface[f.siteSurface]} · ${OPTION_LABELS.power[f.power]} · space: ${f.availableSpace || "not sure"} · access: ${f.siteAccess || "not sure"}`],
                ["Budget", OPTION_LABELS.budget[f.budget]],
                ["Contact", `${f.name} · ${f.email}${f.phone ? " · " + f.phone : ""}`],
              ].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[130px_1fr] gap-3 px-4 py-3"><dt className="font-medium">{k}</dt><dd className="text-ink-soft">{v}</dd></div>
              ))}
            </dl>
            <div className="rounded-xl bg-accent-wash p-4 text-sm text-accent-strong">
              <strong>What happens next:</strong> we review your brief and contact operators. You will not be charged and nothing is booked by submitting this request.
              No payment details are collected at this stage.
            </div>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4" checked={f.acknowledged} onChange={(e) => set("acknowledged", e.target.checked)} />
              <span>I understand this is a request for a quote, not a confirmed booking.</span>
            </label>
          </>
        )}
      </div>

      {errors.length > 0 && (
        <ul role="alert" className="mt-6 space-y-1 rounded-xl bg-danger-wash p-4 text-sm text-danger">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
      )}
      {submitError && <p role="alert" data-testid="submit-error" className="mt-6 rounded-xl bg-danger-wash p-4 text-sm text-danger">{submitError}</p>}

      <div className="mt-8 flex items-center justify-between gap-3">
        <button type="button" className="btn-ghost" onClick={() => { setErrors([]); setStep((s) => Math.max(0, s - 1)); }} disabled={step === 0 || submitting}>Back</button>
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn-primary" onClick={next}>Continue</button>
        ) : (
          <button type="button" className="btn-primary" onClick={submit} disabled={submitting}>{submitting ? "Submitting…" : "Submit request"}</button>
        )}
      </div>
    </div>
  );
}
