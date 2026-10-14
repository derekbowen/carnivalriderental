import type { Metadata } from "next";
import { Concierge } from "@/components/concierge/Concierge";
import { RIDE_TYPES } from "@/lib/inventory";
import { US_STATES } from "@/lib/taxonomy";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Carnival Ride Concierge", robots: { index: false, follow: false } };
export default function ConciergePage() {
  return <div className="mx-auto max-w-5xl px-4 py-10"><p className="eyebrow">Plan your event</p><h1 className="mt-2 text-4xl">Carnival Ride Concierge</h1><p className="mt-3 text-ink-soft">Tell me about your event — where is it, when is it, and what rides are you looking for?</p><Concierge rideTypes={RIDE_TYPES.map(t => ({ id: t.id, name: t.name }))} states={US_STATES.map(s => ({ code: s.abbr.toUpperCase(), name: s.name }))} /></div>;
}
