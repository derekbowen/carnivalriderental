"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ProtectedForm } from "@/components/access/ProtectedForm";
import { paths } from "@/lib/seo/routes";
import type { OperatorCard } from "@/lib/catalog/operator-search";

type Message = { role: "user" | "assistant"; content: string };
type Pass = { id: string; productName: string; remaining: number; usable: boolean; operators: { operatorId: string; label: string; homeState: string | null }[]; unlocks: { operatorId: string; contact: Record<string, unknown> }[] };
export function ChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: "Hi! I can help you find rides, understand Event Access, or use your pass. Tell me about your event — where is it, when is it, and what rides are you looking for?" }]);
  const [cards, setCards] = useState<OperatorCard[]>([]), [rideType, setRideType] = useState<string | null>(null), [passes, setPasses] = useState<Pass[]>([]);
  const [offer, setOffer] = useState<{ eventId: string; productName: string; price: string; operators: number; sellable: boolean } | null>(null);
  const [captureEmail, setCaptureEmail] = useState("");
  const [remind, setRemind] = useState(false), [emailed, setEmailed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("cr_customer_chat") || "null");
      if (Array.isArray(saved) && saved.length <= 24 && saved.every(m => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.length <= 4000)) setMessages(saved);
    } catch { /* Invalid or blocked tab storage: start a fresh conversation. */ }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) { try { sessionStorage.setItem("cr_customer_chat", JSON.stringify(messages.slice(-24))); } catch { /* Chat works without storage. */ } }
  }, [messages, hydrated]);
  const add = (content: string) => setMessages(m => [...m, { role: "assistant", content }]);
  async function call(action: Record<string, unknown>) {
    const response = await fetch("/api/concierge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Please try again later.");
    if (data.message) add(data.message);
    if (data.search) setCards(data.search.cards);
    if ("selectedRideType" in data) setRideType(data.selectedRideType);
    if (data.offer) setOffer(data.offer);
    if (data.passes) setPasses(data.passes);
    if (data.request) add(data.request.message);
    if (data.captured?.emailed) setEmailed(true);
    return data;
  }
  // Lifecycle hook only (listing_viewed); keepalive so it survives the navigation, never blocks it.
  function listingViewed(listingId: string) { void fetch("/api/concierge", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "listing", listingId }) }).catch(() => undefined); }
  async function run(action: Record<string, unknown>) { setBusy(true); try { await call(action); } catch (e) { add((e as Error).message); } finally { setBusy(false); } }
  async function chat(text: string) { const history = messages.slice(-10); setMessages(m => [...m, { role: "user", content: text }]); setInput(""); setOffer(null); await run({ action: "chat", message: text, history }); }
  if (pathname.startsWith("/internal")) return null;
  return <aside className="fixed bottom-4 right-4 z-50" aria-label="Customer support chat">
    {open && <section role="dialog" aria-label="Carnival Ride Rental chat" className="mb-3 flex h-[min(650px,80dvh)] w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
      <header className="flex items-center justify-between bg-ink p-4 text-white"><div><strong>Carnival Ride Rental</strong><p className="text-xs">AI customer assistant</p></div><button aria-label="Close chat" onClick={() => setOpen(false)}>✕</button></header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.map((m, i) => <p key={i} className={`whitespace-pre-wrap rounded-xl p-3 text-sm ${m.role === "user" ? "ml-8 bg-ink text-white" : "mr-4 bg-canvas"}`}>{m.content}</p>)}
        {cards.slice(0, 4).map(c => <div key={c.id} className="rounded-xl border border-line p-3 text-sm">{c.photo && <img src={c.photo.src} alt={c.title} className="h-24 w-full rounded object-cover" />}<strong>{c.title}</strong><p>{c.rideClassLabel} · {c.homeState} · approximately {c.miles} miles</p><p>{c.claimed ? "Claimed" : "Unclaimed"} · date availability unconfirmed</p><Link className="underline" href={paths.rideListing(c.id)} onClick={() => listingViewed(c.id)}>View ride details</Link><button disabled={busy} className="ml-2 underline" onClick={() => void run({ action: "availability", listingId: c.id })}>Request Availability</button></div>)}
        {cards.length > 0 && !emailed && <form className="rounded-xl border border-line p-3 text-sm" onSubmit={e => { e.preventDefault(); void run({ action: "capture", email: captureEmail, followupConsent: remind }); }}><strong>Email me these options</strong><p className="text-xs text-muted">We send your matches once. Nothing else unless you tick the box.</p><input aria-label="Email for these options" type="email" required maxLength={200} className="input mt-2 w-full" value={captureEmail} onChange={e => setCaptureEmail(e.target.value)} /><label className="mt-2 block text-xs"><input type="checkbox" checked={remind} onChange={e => setRemind(e.target.checked)} /> Also remind me about this search if I don&apos;t finish (at most two emails over two days; unsubscribe anytime).</label><button className="btn-ghost mt-2" disabled={busy || !captureEmail.trim()}>Email me these options</button></form>}
        {offer && <div className="rounded-xl border border-line p-3 text-sm"><strong>{offer.productName} — {offer.price}</strong><p>{offer.operators} qualifying operators. This offer covers the selected ride requirement, not a booking.</p>{offer.sellable ? <ProtectedForm action="/api/access/checkout"><input type="hidden" name="event" value={offer.eventId} /><button className="btn-primary mt-2">Buy Event Access</button></ProtectedForm> : <p>Not enough qualifying operators to sell access.</p>}</div>}
        {passes.map(p => <div key={p.id} className="rounded-xl border border-line p-3 text-sm"><strong>{p.productName}</strong><p>{p.usable ? "Active" : "Inactive"} · {p.remaining} unlocks remaining</p><Link href={paths.pass(p.id)} className="underline">Full pass</Link>{p.operators.map(op => { const u = p.unlocks.find(x => x.operatorId === op.operatorId); return <div key={op.operatorId} className="mt-2"><p>{op.label} · {op.homeState}</p>{u ? <p className="whitespace-pre-wrap">{Object.entries(u.contact).filter(([,v]) => v != null).map(([k,v]) => `${k}: ${String(v)}`).join("\n")}</p> : <button className="underline" disabled={busy || !p.usable || p.remaining < 1} onClick={() => void run({ action: "unlock", passId: p.id, operatorId: op.operatorId })}>Unlock operator contact</button>}</div>; })}</div>)}
        {busy && <p role="status" className="text-sm">Working on that…</p>}
      </div>
      <div className="border-t border-line p-3"><div className="mb-2 flex flex-wrap gap-2 text-xs"><button disabled={busy} className="rounded-full border px-2 py-1" onClick={() => void chat("How does Event Access work?")}>How it works</button><button disabled={busy} className="rounded-full border px-2 py-1" onClick={() => void run({ action: "checkout", rideType })}>See access offer</button><button disabled={busy} className="rounded-full border px-2 py-1" onClick={() => void run({ action: "status" })}>My pass</button><button disabled={busy} className="rounded-full border px-2 py-1" onClick={() => void run({ action: "availability", listingId: null })}>Request My Event</button></div>
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (input.trim()) void chat(input.trim()); }}><input aria-label="Message customer assistant" maxLength={3000} value={input} onChange={e => setInput(e.target.value)} className="input min-w-0 flex-1" placeholder="Ask a question…" /><button disabled={busy || !input.trim()} className="btn-primary">Send</button></form>
        <p className="mt-2 text-[10px] text-muted">AI can make mistakes. Event details are saved; messages use AI Gateway and a model provider. <Link className="underline" href={paths.privacy()}>Privacy</Link> · <Link className="underline" href={paths.contact()}>Human help</Link></p>
      </div>
    </section>}
    <button className="btn-primary float-right shadow-lg" aria-expanded={open} onClick={() => { setOpen(!open); if (!open) void run({ action: "status" }); }}>{open ? "Close chat" : "Chat with us"}</button>
  </aside>;
}
