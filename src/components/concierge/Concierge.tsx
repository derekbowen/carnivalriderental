"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ProtectedForm } from "@/components/access/ProtectedForm";
import { paths } from "@/lib/seo/routes";
import type { Lead } from "@/lib/concierge/schema";
import { emptyLead } from "@/lib/concierge/defaults";
import type { OperatorCard } from "@/lib/catalog/operator-search";
import type { Unlock } from "@/lib/access/service";

type PassStatus = { id: string; expiresAt: string; remaining: number; usable: boolean; productName: string; event: { city: string; state: string; eventDate: string; rideType: string | null }; operators: { operatorId: string; label: string; claimed: boolean; homeState: string | null; miles: number }[]; unlocks: Unlock[] };
type Offer = { eventId: string; operators: number; productName: string; price: string; unlockLimit: number; validityDays: number; sellable: boolean };
type Reply = { captured?: { emailed: boolean; remind: boolean }; selectedRideType?: string | null; error?: string; message?: string; details: Lead; search?: { cards: OperatorCard[]; total: number; availability: string; locationPrecision: string }; offer?: Offer; passes?: PassStatus[]; requests?: { id: string; status: string }[]; request?: { id: string; message: string } };
export function Concierge({ rideTypes, states }: { rideTypes: { id: string; name: string }[]; states: { code: string; name: string }[] }) {
  const [details, setDetails] = useState<Lead>(emptyLead), [message, setMessage] = useState(""), [reply, setReply] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(true);
  const [remind, setRemind] = useState(false), [emailed, setEmailed] = useState(false);
  const [rideType, setRideType] = useState(""), [quantity, setQuantity] = useState(1), [search, setSearch] = useState<Reply["search"]>(), [offer, setOffer] = useState<Offer>(), [passes, setPasses] = useState<PassStatus[]>([]), [requests, setRequests] = useState<{ id: string; status: string }[]>([]);
  async function send(action: Record<string, unknown>) {
    setError("");
    const res = await fetch("/api/concierge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action) });
    const data: Reply = await res.json();
    if (!res.ok) throw new Error(data.error || "Please try again.");
    setDetails(data.details);
    if (data.message) setReply(data.message);
    if (data.search) setSearch(data.search);
    if ("selectedRideType" in data) setRideType(data.selectedRideType ?? "");
    if (data.offer) setOffer(data.offer);
    if (data.passes) setPasses(data.passes);
    if (data.requests) setRequests(data.requests);
    if (data.captured?.emailed) setEmailed(true);
    if (data.request) { setReply(data.request.message); setRequests(r => [...r, { id: data.request!.id, status: "received" }]); }
    return data;
  }
  // Lifecycle hook only (listing_viewed); keepalive so it survives the navigation, never blocks it.
  function listingViewed(listingId: string) { void fetch("/api/concierge", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "listing", listingId }) }).catch(() => undefined); }
  async function run(fn: () => Promise<unknown>) { setBusy(true); try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  useEffect(() => { void run(() => send({ action: "status" })); /* intentional initial resume */ }, []);
  function field<K extends keyof Lead>(key: K, value: Lead[K]) { setDetails(d => ({ ...d, [key]: value })); setOffer(undefined); }
  async function save() {
    const next = rideType && !details.requestedRides.some(r => r.rideType === rideType) ? { ...details, requestedRides: [...details.requestedRides, { rideType, quantity }] } : details;
    await send({ action: "save", details: next }); setOffer(undefined);
  }
  return <div className="mt-6 space-y-6">
    <form className="card space-y-3 p-5" onSubmit={e => { e.preventDefault(); void run(() => send({ action: "chat", message }).then(() => { setMessage(""); setOffer(undefined); })); }}>
      <label htmlFor="event-message" className="font-semibold">Tell us what you’re planning</label>
      <textarea id="event-message" className="input w-full" maxLength={3000} value={message} onChange={e => setMessage(e.target.value)} placeholder="A county fair in Perris, CA, March 14, 2027. We need one Ferris wheel…" />
      <button className="btn-primary" disabled={busy || !message.trim()}>Capture event details</button>
      <p className="text-xs text-muted">AI interprets your message only. Search, payment and contact access are controlled by the application. Your message and prior event details are processed by our model provider through AI Gateway. You can also use the form without AI.</p>
    </form>
    {reply && <p role="status" className="card p-4">{reply}</p>}{error && <p role="alert" className="card p-4">{error}</p>}
    <section className="card p-5"><h2 className="text-2xl">Your event</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">
      {([['eventDate', 'Event date', 'date'], ['city', 'City', 'text'], ['zip', 'ZIP', 'text'], ['eventType', 'Event type', 'text'], ['attendance', 'Attendance', 'number'], ['budgetUsd', 'Budget (USD, optional)', 'number'], ['contactName', 'Your name', 'text'], ['email', 'Email', 'email'], ['phone', 'Your phone (optional)', 'tel']] as const).map(([key, label, type]) => <label key={key} className="text-sm">{label}<input aria-label={label} className="input mt-1 w-full" type={type} maxLength={200} min={0} value={details[key] ?? ""} onChange={e => field(key, (type === "number" ? e.target.value === "" ? null : Number(e.target.value) : e.target.value || null) as never)} /></label>)}
      <label className="text-sm">State<select aria-label="State" className="input mt-1 w-full" value={details.state ?? ""} onChange={e => field("state", e.target.value || null)}><option value="">Choose state</option>{states.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}</select></label>
      <label className="text-sm sm:col-span-2">Setup constraints<textarea aria-label="Setup constraints" className="input mt-1 w-full" maxLength={1500} value={details.setupConstraints ?? ""} onChange={e => field("setupConstraints", e.target.value || null)} /></label>
    </div>
    <div className="mt-4 flex flex-wrap items-end gap-3"><label>Ride requirement<select aria-label="Ride requirement" className="input block" value={rideType} onChange={e => { setRideType(e.target.value); setOffer(undefined); }}><option value="">Any carnival ride</option>{rideTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Quantity<input aria-label="Quantity" className="input block w-24" type="number" min={1} max={100} value={quantity} onChange={e => setQuantity(Number(e.target.value))} /></label><button type="button" className="btn-ghost" disabled={busy || !rideType || details.requestedRides.length >= 12} onClick={() => field("requestedRides", [...details.requestedRides.filter(r => r.rideType !== rideType), { rideType, quantity }])}>Add requirement</button></div>
    <ul className="mt-3">{details.requestedRides.map(r => <li key={r.rideType}>{r.quantity ?? "Unspecified quantity"} × {rideTypes.find(t => t.id === r.rideType)?.name} <button className="underline text-sm" onClick={() => field("requestedRides", details.requestedRides.filter(x => x.rideType !== r.rideType))}>Remove</button></li>)}</ul>
    <div className="mt-4 flex flex-wrap gap-3"><button disabled={busy} className="btn-ghost" onClick={() => void run(save)}>Save event</button><button disabled={busy} className="btn-primary" onClick={() => void run(async () => { await save(); await send({ action: "search", rideType: rideType || null }); })}>Find matching rides</button><button disabled={busy} className="btn-ghost" onClick={() => void run(async () => { await save(); await send({ action: "checkout", rideType: rideType || null }); })}>See Event Access offer</button><button disabled={busy} className="btn-ghost" onClick={() => void run(async () => { await save(); await send({ action: "availability", listingId: null }); })}>Request My Event</button></div>
    <p className="mt-3 text-sm text-muted">Each Event Access purchase covers the selected ride requirement for one event—not every requirement in a mixed event. Review the server-confirmed tier before paying.</p></section>
    {offer && <section className="card p-5" data-testid="concierge-offer"><h2 className="text-2xl">{offer.productName} — {offer.price}</h2><p>{offer.operators} matching, contactable operators. Unlock up to {offer.unlockLimit} within {offer.validityDays} days.</p>{offer.sellable ? <ProtectedForm action="/api/access/checkout"><input type="hidden" name="event" value={offer.eventId} /><button className="btn-primary mt-4">Buy Event Access</button></ProtectedForm> : <p>Not enough qualifying operators to sell access. Save an event request instead.</p>}<p className="mt-2 text-sm">Access is not a booking or an availability guarantee.</p></section>}
    {search && <section><h2 className="text-2xl">{search.total} matching listings nationwide</h2><p>{search.availability}</p><p className="text-sm">Sorted by approximate home-base distance; not confirmed service or current ride location. Origin: {search.locationPrecision}.</p>{search.total > 0 && !emailed && <form className="card mt-4 space-y-2 p-4" data-testid="concierge-capture" onSubmit={e => { e.preventDefault(); void run(async () => { await save(); await send({ action: "capture", email: details.email ?? "", followupConsent: remind }); }); }}><h3 className="text-xl">Email me these options</h3><p className="text-sm text-muted">We email your matches for {details.email || "the email above"} once. Nothing else unless you tick the box.</p><label className="block text-sm"><input type="checkbox" checked={remind} onChange={e => setRemind(e.target.checked)} /> Also remind me about this search if I don&apos;t finish (at most two emails over two days; unsubscribe anytime).</label><button className="btn-ghost" disabled={busy || !details.email}>Email me these options</button></form>}<ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{search.cards.map(c => <li key={c.id} className="card p-4">{c.photo && <img src={c.photo.src} alt={c.title} className="h-40 w-full rounded object-cover" />}<h3 className="mt-2 text-xl">{c.title}</h3><p>{c.rideClassLabel} · {c.homeState} · approximately {c.miles} miles</p><p>{c.claimed ? "Claimed" : "Unclaimed"} operator</p><Link href={paths.rideListing(c.id)} className="underline" onClick={() => listingViewed(c.id)}>Ride specifications</Link><button className="btn-ghost mt-2" disabled={busy} onClick={() => void run(async () => { await save(); await send({ action: "availability", listingId: c.id }); })}>Request Availability</button></li>)}</ul></section>}
    <section className="card p-5"><h2 className="text-2xl">Your Event Access</h2><button className="underline" disabled={busy} onClick={() => void run(() => send({ action: "status" }))}>Refresh access and requests</button>{passes.length === 0 && <p className="mt-2">No verified pass in this browser. <Link href={paths.passRecover()} className="underline">Recover your access link</Link>.</p>}{passes.map(p => <div key={p.id} className="mt-5"><h3 className="text-xl">{p.productName}</h3><p>{p.event.city}, {p.event.state} · {p.event.eventDate} · {p.event.rideType ?? "Any ride"}</p><p>{p.usable ? "Active until" : "Inactive; expired or revoked"} {p.expiresAt.slice(0, 10)} · {p.remaining} remaining unlocks</p><Link className="underline" href={paths.pass(p.id)}>Open full pass</Link><ul>{p.operators.map(op => { const unlocked = p.unlocks.find(u => u.operatorId === op.operatorId); return <li className="mt-3 border-t border-line pt-3" key={op.operatorId}><p>{op.label} · {op.homeState} · approximately {op.miles} miles · {op.claimed ? "Claimed" : "Unclaimed"}</p>{unlocked ? <dl data-testid="concierge-contact">{Object.entries(unlocked.contact).filter(([, v]) => v !== null).map(([key, value]) => <div key={key}><dt className="inline font-semibold">{key}: </dt><dd className="inline">{String(value)}</dd></div>)}</dl> : <button className="btn-ghost" disabled={busy || !p.usable || p.remaining < 1} onClick={() => void run(() => send({ action: "unlock", passId: p.id, operatorId: op.operatorId }))}>Unlock operator contact</button>}</li>; })}</ul></div>)}</section>
    {requests.length > 0 && <section className="card p-5"><h2 className="text-2xl">Your event requests</h2><ul>{requests.map(r => <li key={r.id}>Request {r.id.slice(0, 8)}: {r.status} — availability unconfirmed</li>)}</ul></section>}
  </div>;
}
