import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AcceptQuoteButton } from "@/components/status/AcceptQuoteButton";
import { getRide } from "@/lib/content";
import { getRequestService } from "@/lib/requests";
import { verifyCustomerToken } from "@/lib/requests/access";
import { briefDates, FULFILMENT_LABELS, FULFILMENT_STEPS, formatUsd, notSure, OPTION_LABELS, PAYMENT_LABELS, QUOTE_PRICE_LABEL } from "@/lib/requests/labels";
import { toPublicView } from "@/lib/requests/projection";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your event request", robots: { index: false, follow: false } };

export default async function StatusPage({ params, searchParams }: { params: Promise<{ reference: string }>; searchParams: Promise<{ t?: string; new?: string }> }) {
  const { reference } = await params;
  const { t, new: isNew } = await searchParams;
  const svc = getRequestService();
  const req = svc.getByReference(decodeURIComponent(reference));
  if (!req || !verifyCustomerToken(req.id, t)) notFound();
  const view = toPublicView(req, svc.listQuotes(req.id), svc.listEvents(req.id));
  const label = FULFILMENT_LABELS[view.fulfilmentStatus];
  const stepIdx = FULFILMENT_STEPS.indexOf(view.fulfilmentStatus);
  const closed = stepIdx === -1;
  const openQuote = view.quotes.find((q) => q.status === "sent");
  const b = view.brief;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      {isNew && (
        <div data-testid="request-received" className="mb-8 rounded-2xl border border-ok/30 bg-ok-wash p-6">
          <h1 className="text-2xl text-ok">Request received — not yet booked</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Your request <strong>{view.reference}</strong> is saved. Bookmark this page: it is your private link to follow progress. We have not sent any email from this development build.
          </p>
        </div>
      )}
      <p className="eyebrow">Event request {view.reference}</p>
      <h2 className="mt-2 text-4xl" data-testid="fulfilment-title">{label.title}</h2>
      <p className="mt-2 max-w-2xl text-ink-soft">{label.detail}</p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <section className="card p-6">
            <h3 className="text-2xl">Fulfilment</h3>
            {closed ? (
              <p className="mt-3 text-sm text-ink-soft">This request is closed: {label.title.toLowerCase()}.</p>
            ) : (
              <ol className="mt-6">
                {FULFILMENT_STEPS.map((s, i) => {
                  const state = i < stepIdx ? "done" : i === stepIdx ? "current" : "todo";
                  const last = i === FULFILMENT_STEPS.length - 1;
                  return (
                    <li key={s} className="relative flex gap-4 pb-6 last:pb-0" aria-current={state === "current" ? "step" : undefined}>
                      {!last && <span aria-hidden className={`absolute left-[11px] top-7 h-[calc(100%-24px)] w-px ${state === "done" ? "bg-ink" : "bg-line-strong"}`} />}
                      <span className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] ${state === "done" ? "bg-ink text-canvas" : state === "current" ? "border-2 border-accent bg-surface" : "border border-line-strong bg-surface"}`}>
                        {state === "done" ? "✓" : state === "current" ? <span className="h-2 w-2 rounded-full bg-accent" /> : null}
                        <span className="sr-only">{state === "done" ? "Completed" : state === "current" ? "In progress" : "Not started"}</span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`font-medium ${state === "todo" ? "text-muted" : ""}`}>{FULFILMENT_LABELS[s].title}</p>
                        {state === "current" && <p className="mt-0.5 text-sm text-muted">{FULFILMENT_LABELS[s].detail}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <section className="card p-6">
            <h3 className="text-2xl">Quotes</h3>
            {view.quotes.length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">No quote yet. We send one after matching your event to an operator.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {[...view.quotes].reverse().map((q) => (
                  <li key={q.id} className={`rounded-xl border p-4 ${q.status === "sent" || q.status === "accepted" ? "border-ink" : "border-line opacity-70"}`}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{QUOTE_PRICE_LABEL[q.status]} · v{q.version}</span>
                      <span className="font-display text-2xl">{formatUsd(q.amountCents)}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-line text-sm text-ink-soft">{q.scope}</p>
                  </li>
                ))}
              </ul>
            )}
            {openQuote && view.fulfilmentStatus === "quote_sent" && (
              <div className="mt-5 border-t border-line pt-5">
                <p className="mb-3 text-sm text-ink-soft">Accepting tells us to secure the operator. Your booking is confirmed only after the operator commits and the agreed payment step is complete.</p>
                <AcceptQuoteButton reference={view.reference} token={t!} quoteId={openQuote.id} amount={formatUsd(openQuote.amountCents)} />
              </div>
            )}
          </section>

          <section className="card p-6">
            <h3 className="text-2xl">Your event brief</h3>
            <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div><dt className="text-muted">Ride</dt><dd>{b.rideSlug ? getRide(b.rideSlug)?.name ?? b.rideSlug : "Need advice"} · {OPTION_LABELS.rideFlexibility[b.rideFlexibility]}</dd></div>
              <div><dt className="text-muted">Dates</dt><dd>{briefDates(b)} · {OPTION_LABELS.dateFlexibility[b.dateFlexibility]}</dd></div>
              <div><dt className="text-muted">Location</dt><dd>{b.venueName ? `${b.venueName}, ` : ""}{b.city}, {b.state}</dd></div>
              <div><dt className="text-muted">Event</dt><dd>{OPTION_LABELS.eventType[b.eventType]} · {OPTION_LABELS.expectedAttendance[b.expectedAttendance]}</dd></div>
              <div><dt className="text-muted">Site</dt><dd>{OPTION_LABELS.siteSurface[b.siteSurface]} · {OPTION_LABELS.power[b.power]}</dd></div>
              <div><dt className="text-muted">Space / access</dt><dd>{notSure(b.availableSpace)} / {notSure(b.siteAccess)}</dd></div>
              <div><dt className="text-muted">Budget</dt><dd>{OPTION_LABELS.budget[b.budget]}</dd></div>
              <div><dt className="text-muted">Contact</dt><dd>{b.contact.name} · {b.contact.email}</dd></div>
            </dl>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="card p-6" data-testid="payment-panel">
            <h3 className="text-2xl">Payment</h3>
            <p className="mt-2 font-medium" data-testid="payment-status">{PAYMENT_LABELS[view.paymentStatus]}</p>
            <p className="mt-3 rounded-lg bg-demo-wash p-3 text-xs text-demo">Demo mode: no card details are collected and no money moves in this build. Payment terms will be set out in your quote.</p>
          </section>
          <Link href="/rides" className="btn-ghost w-full">Browse rides</Link>
        </aside>
      </div>
    </div>
  );
}
