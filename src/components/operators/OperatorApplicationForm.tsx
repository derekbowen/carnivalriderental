"use client";

import { useState } from "react";

type StateOption = { code: string; name: string };
type Status = { kind: "idle" } | { kind: "sending" } | { kind: "done" } | { kind: "error"; message: string; fields: Record<string, string> };

/** Early-access application. Posts JSON to /api/operator-applications; stores nothing in the browser. */
export function OperatorApplicationForm({ states, brandName }: { states: StateOption[]; brandName: string }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      companyName: String(fd.get("companyName") ?? ""),
      contactName: String(fd.get("contactName") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      homeState: String(fd.get("homeState") ?? ""),
      statesServed: String(fd.get("statesServed") ?? ""),
      rides: String(fd.get("rides") ?? ""),
      website: String(fd.get("website") ?? ""),
      consent: fd.get("consent") === "on",
      fax: String(fd.get("fax") ?? ""),
    };
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/operator-applications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => null);
      if (res.status === 201 && json?.ok) return setStatus({ kind: "done" });
      if (res.status === 400 && json?.fields) return setStatus({ kind: "error", message: "Please check the highlighted fields.", fields: json.fields });
      setStatus({ kind: "error", message: "We couldn't save your application. Please try again in a moment.", fields: {} });
    } catch {
      setStatus({ kind: "error", message: "Network problem — your application was not sent. Please try again.", fields: {} });
    }
  }

  if (status.kind === "done") {
    return (
      <div role="status" data-testid="application-received" className="card p-6">
        <h3 className="text-xl">Application received</h3>
        <p className="mt-2 text-sm text-ink-soft">Thanks. Your details are with our team, and we&apos;ll contact you before the operator program opens. You haven&apos;t been signed up for anything yet, and no listing has been created.</p>
      </div>
    );
  }

  const fields = status.kind === "error" ? status.fields : {};
  // Errors sit outside the <label> and are linked with aria-describedby, so a field's accessible name stays its label.
  const err = (k: string) => (fields[k] ? <span id={`err-${k}`} className="mt-1 block text-xs text-danger">{fields[k]}</span> : null);
  const a11y = (k: string) => (fields[k] ? { "aria-invalid": true, "aria-describedby": `err-${k}` } : {});
  const optional = <span className="font-normal text-muted">(optional)</span>;

  return (
    <form onSubmit={onSubmit} noValidate className="card grid gap-4 p-6 sm:grid-cols-2">
      <div><label className="block"><span className="label">Company name</span><input name="companyName" className="input" autoComplete="organization" required {...a11y("companyName")} /></label>{err("companyName")}</div>
      <div><label className="block"><span className="label">Your name</span><input name="contactName" className="input" autoComplete="name" required {...a11y("contactName")} /></label>{err("contactName")}</div>
      <div><label className="block"><span className="label">Email</span><input name="email" type="email" className="input" autoComplete="email" required {...a11y("email")} /></label>{err("email")}</div>
      <div><label className="block"><span className="label">Mobile phone</span><input name="phone" type="tel" className="input" autoComplete="tel" required {...a11y("phone")} /></label>{err("phone")}</div>
      <div>
        <label className="block">
          <span className="label">Home base state</span>
          <select name="homeState" className="input" defaultValue="" required {...a11y("homeState")}>
            <option value="" disabled>Choose a state</option>
            {states.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </label>
        {err("homeState")}
      </div>
      <div><label className="block"><span className="label">States you serve {optional}</span><input name="statesServed" className="input" placeholder="e.g. TX, OK, LA" {...a11y("statesServed")} /></label>{err("statesServed")}</div>
      <div className="sm:col-span-2"><label className="block"><span className="label">Your rides</span><textarea name="rides" rows={4} className="input" placeholder="e.g. 1 Ferris wheel, 1 carousel, 3 kiddie rides" required {...a11y("rides")} /></label>{err("rides")}</div>
      <div className="sm:col-span-2"><label className="block"><span className="label">Website {optional}</span><input name="website" className="input" placeholder="https://" {...a11y("website")} /></label>{err("website")}</div>
      {/* Honeypot: hidden from people and assistive tech. */}
      <div aria-hidden="true" className="hidden"><label>Fax<input name="fax" tabIndex={-1} autoComplete="off" /></label></div>
      <label className="flex items-start gap-3 text-sm sm:col-span-2">
        <input name="consent" type="checkbox" className="mt-1" required {...a11y("consent")} />
        <span>I agree that {brandName} may contact me by email, phone or text about the operator program. This is not a contract and doesn&apos;t create a listing.</span>
      </label>
      {err("consent")}
      {status.kind === "error" && <p role="alert" className="text-sm text-danger sm:col-span-2">{status.message}</p>}
      <div className="sm:col-span-2">
        <button type="submit" className="btn-primary" disabled={status.kind === "sending"}>{status.kind === "sending" ? "Sending…" : "Apply for early access"}</button>
      </div>
    </form>
  );
}
