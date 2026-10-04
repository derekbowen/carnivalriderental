import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { catalog } from "@/lib/catalog";
import { findForCustomer, toPublicRequest } from "@/lib/requests/public";
import { label } from "@/lib/requests/options";
import { FULFILLMENT_LABEL, PROGRESS } from "@/lib/requests/status";
import { PriceTag } from "@/components/PriceTag";
import { AcceptQuote } from "./AcceptQuote";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your event request", robots: { index: false, follow: false } };

type Props = {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ t?: string; submitted?: string }>;
};

export default async function RequestStatus({ params, searchParams }: Props) {
  const { reference } = await params;
  const { t, submitted } = await searchParams;
  const db = getDb();
  // The page reads the stored request; a confirmation is shown only for a
  // request that actually exists in the database.
  const row = findForCustomer(db, reference, t);
  if (!row) notFound();
  const r = toPublicRequest(db, row);
  const ride = r.brief.rideSlug ? catalog.ride(r.brief.rideSlug) : undefined;
  const reached = new Set(r.timeline.map((x) => x.status));
  const cancelled = r.fulfillment.status === "cancelled";

  return (
    <main className="container-page py-10">
      {submitted ? (
        <div role="status" className="mb-8 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="font-semibold text-emerald-900">Request received — this is not a booking yet</div>
          <p className="mt-1 text-sm text-emerald-900/80">
            Your reference is <strong>{r.reference}</strong>. Bookmark this page to check progress. Our team will source an
            operator and send you a written quote.
          </p>
        </div>
      ) : null}

      <p className="eyebrow">Event request {r.reference}</p>
      <h1 className="mt-2 font-display text-4xl">{r.fulfillment.label}</h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-8">
          <section className="card p-6">
            <h2 className="font-semibold">Progress</h2>
            <ol className="mt-4 space-y-3">
              {PROGRESS.map((s) => {
                const done = reached.has(s);
                const current = r.fulfillment.status === s;
                return (
                  <li key={s} className="flex items-start gap-3 text-sm">
                    <span
                      aria-hidden
                      className={`mt-0.5 inline-block h-4 w-4 shrink-0 rounded-full border-2 ${current ? "border-marquee bg-marquee" : done ? "border-ink bg-ink" : "border-line bg-white"}`}
                    />
                    <span className={current ? "font-semibold" : done ? "" : "text-ink-muted"}>{FULFILLMENT_LABEL[s]}</span>
                  </li>
                );
              })}
              {cancelled ? <li className="text-sm font-semibold text-red-800">{FULFILLMENT_LABEL.cancelled}</li> : null}
            </ol>
          </section>

          <section className="card p-6">
            <h2 className="font-semibold">Payment</h2>
            <p className="mt-2 text-sm">{r.payment.label}</p>
            <p className="mt-2 text-xs text-ink-muted">
              Payment status is tracked separately from your booking. Online payment is not connected in this development
              build — no card details are collected.
            </p>
          </section>

          <section className="card p-6">
            <h2 className="font-semibold">Your event brief</h2>
            <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {[
                ["Ride", ride?.name ?? "Open — we'll suggest options"],
                ["Ride flexibility", label("rideFlexibility", r.brief.rideFlexibility)],
                ["Dates", `${r.brief.dateStart}${r.brief.dateEnd ? ` to ${r.brief.dateEnd}` : ""}`],
                ["Location", `${r.brief.city}, ${r.brief.state}${r.brief.venue ? ` · ${r.brief.venue}` : ""}`],
                ["Event", label("eventType", r.brief.eventType)],
                ["Attendance", label("expectedAttendance", r.brief.expectedAttendance)],
                ["Budget", label("budget", r.brief.budget)],
                ["Site", `${label("siteAccess", r.brief.siteAccess)} · ${label("availableSpace", r.brief.availableSpace)} · ${label("power", r.brief.power)}`],
              ].map(([k, val]) => (
                <div key={k}><dt className="text-ink-muted">{k}</dt><dd className="font-medium">{val}</dd></div>
              ))}
            </dl>
          </section>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="card p-6">
            <h2 className="font-semibold">Your quote</h2>
            {r.quote ? (
              <div className="mt-4">
                <PriceTag size="lg" price={{ kind: "quote", cents: r.quote.priceCents, status: r.quote.status }} />
                <p className="mt-4 whitespace-pre-line text-sm">{r.quote.scope}</p>
                <p className="mt-2 text-xs text-ink-muted">Quote version {r.quote.version}</p>
                {r.quote.status === "sent" && r.fulfillment.status === "quote_sent" ? (
                  <AcceptQuote reference={r.reference} token={t!} quoteId={r.quote.id} />
                ) : null}
                {r.quote.status === "accepted" && r.fulfillment.status !== "confirmed" ? (
                  <p className="mt-4 rounded-md bg-sky-50 p-3 text-sm text-sky-900">
                    You accepted this quote. Your booking is confirmed only once the operator commits — we&apos;ll update this
                    page.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">No quote yet. We send one after sourcing an operator for your date.</p>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
