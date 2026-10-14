import Link from "next/link";
import { outreachAllowed } from "@/lib/requests/state";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/internal/ActionButton";
import { AddCandidateForm, CustomerQuoteForm, SupplierQuoteForm } from "@/components/internal/Forms";
import { getRide } from "@/lib/content";
import { getRequestService } from "@/lib/requests";
import { statusPath } from "@/lib/requests/access";
import { briefDates, FULFILMENT_LABELS, formatUsd, notSure, OPTION_LABELS, PAYMENT_LABELS, QUOTE_PRICE_LABEL } from "@/lib/requests/labels";
import { projectMargin } from "@/lib/requests/margin";
import { canTransition, canTransitionPayment, PAYMENT_POLICY } from "@/lib/requests/state";
import { PAYMENT_STATUSES } from "@/lib/requests/types";
import { RequestService } from "@/lib/requests/service";

const money = (c: number | null) => (c === null ? <span className="italic text-warn">Unknown</span> : formatUsd(c));

export default async function InternalRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const svc = getRequestService();
  const r = svc.getRequest(id);
  if (!r) notFound();
  const quotes = svc.listQuotes(id);
  const candidates = svc.listCandidates(id);
  const supplierQuotes = svc.listSupplierQuotes(id);
  const suppliers = svc.listSuppliers();
  const units = svc.listUnits();
  const events = svc.listEvents(id);
  const b = r.brief;
  const supplierName = (sid: string) => suppliers.find((s) => s.id === sid)?.name ?? sid;

  const priceQuote = quotes.find((q) => q.status === "accepted") ?? [...quotes].reverse().find((q) => q.status === "sent") ?? null;
  const committed = candidates.find((c) => c.stage === "committed");
  const basisSupplierId = committed?.supplierId ?? supplierQuotes.at(-1)?.supplierId ?? null;
  const basisQuote = basisSupplierId ? [...supplierQuotes].reverse().find((q) => q.supplierId === basisSupplierId) ?? null : null;
  const margin = projectMargin(priceQuote?.amountCents ?? null, basisQuote, null);
  const teamMoves = RequestService.TEAM_DIRECT.filter((s) => canTransition(r.fulfilmentStatus, s));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/internal" className="text-sm text-muted hover:underline">← Queue</Link>
          <h1 className="mt-1 font-mono text-3xl">{r.reference}{r.isTestData && <span className="ml-3 align-middle text-sm text-demo">test data</span>}</h1>
          <p className="mt-1 text-sm text-muted">Created {r.createdAt.slice(0, 16).replace("T", " ")} UTC · <a className="underline" href={statusPath(r.reference, r.id)} target="_blank">customer status page ↗</a></p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="card p-3"><div className="text-xs text-muted">Fulfilment</div><div className="font-semibold">{FULFILMENT_LABELS[r.fulfilmentStatus].title}</div></div>
          <div className="card p-3"><div className="text-xs text-muted">Payment <span className="text-demo">(demo)</span></div><div className="font-semibold">{PAYMENT_LABELS[r.paymentStatus]}</div></div>
        </div>
      </div>

      {!outreachAllowed(r.paymentStatus) && (
        <p data-testid="pay-first-lock" role="status" className="rounded-xl border border-danger/30 bg-danger-wash px-4 py-3 text-sm text-danger">
          <strong>Awaiting payment — pay-first policy.</strong> Sourcing, operator contact and quotes are locked until the customer has paid (funds authorized or collected). Do not contact anyone about this request yet.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="text-lg">Event brief</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {[
                ["Ride", `${b.rideSlug ? getRide(b.rideSlug)?.name ?? b.rideSlug : "Needs advice"} · ${OPTION_LABELS.rideFlexibility[b.rideFlexibility]}`],
                ["Dates", `${briefDates(b)} · ${OPTION_LABELS.dateFlexibility[b.dateFlexibility]}`],
                ["Hours", notSure(b.operatingHours)],
                ["Location", `${b.venueName ? b.venueName + ", " : ""}${b.city}, ${b.state}`],
                ["Event", `${OPTION_LABELS.eventType[b.eventType]} · ${OPTION_LABELS.expectedAttendance[b.expectedAttendance]}`],
                ["Budget", OPTION_LABELS.budget[b.budget]],
                ["Surface / power", `${OPTION_LABELS.siteSurface[b.siteSurface]} · ${OPTION_LABELS.power[b.power]}`],
                ["Space / access", `${notSure(b.availableSpace)} / ${notSure(b.siteAccess)}`],
                ["Contact", `${b.contact.name} · ${b.contact.email}${b.contact.phone ? " · " + b.contact.phone : ""}${b.contact.organization ? " · " + b.contact.organization : ""}`],
                ["Notes", b.notes ?? "—"],
              ].map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd>{v}</dd></div>)}
            </dl>
          </section>

          <section className="card p-5">
            <h2 className="text-lg">Supplier candidates</h2>
            <p className="text-xs text-muted">Relationship (global) and stage (this event) are separate. Only verified suppliers that have quoted, with a unit identified, can be committed — and only after the customer accepts.</p>
            <ul className="mt-4 space-y-4">
              {candidates.length === 0 && <li className="text-sm text-muted">No candidates yet.</li>}
              {candidates.map((c) => {
                const s = suppliers.find((x) => x.id === c.supplierId)!;
                const u = units.find((x) => x.id === c.unitId);
                return (
                  <li key={c.id} className="rounded-xl border border-line p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold">{s.name} {s.isDemo && <span className="text-xs text-demo">demo</span>}</div>
                        <div className="text-xs text-muted">Relationship: {s.relationship.replace(/_/g, " ")} · Stage for this event: <strong className="text-ink">{c.stage}</strong></div>
                        <div className="text-xs text-muted">Unit: {u ? `${u.description} (${u.verification})` : "not identified"}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {c.stage === "candidate" && <ActionButton requestId={id} payload={{ action: "set_candidate_stage", candidateId: c.id, stage: "contacted" }} label="Mark contacted" />}
                        {c.stage !== "committed" && c.stage !== "declined" && <ActionButton requestId={id} payload={{ action: "set_candidate_stage", candidateId: c.id, stage: "declined" }} label="Supplier declined" />}
                        {c.stage === "quoted" && r.fulfilmentStatus === "quote_accepted" && <ActionButton requestId={id} variant="primary" payload={{ action: "commit_supplier", candidateId: c.id, note: null }} label="Record commitment" confirmText="Has this supplier committed in writing to this event, unit and scope?" />}
                      </div>
                    </div>
                    {supplierQuotes.filter((q) => q.supplierId === c.supplierId).map((q) => (
                      <div key={q.id} className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-canvas p-3 text-xs sm:grid-cols-4">
                        <div><div className="text-muted">Supplier quote</div>{money(q.supplierPriceCents)}</div>
                        <div><div className="text-muted">Transport</div>{money(q.transportCents)}</div>
                        <div><div className="text-muted">Setup/crew</div>{money(q.crewCents)}</div>
                        <div><div className="text-muted">Other</div>{money(q.otherCents)}</div>
                      </div>
                    ))}
                    {c.stage !== "committed" && c.stage !== "declined" && <SupplierQuoteForm requestId={id} supplierId={c.supplierId} />}
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 border-t border-line pt-4">
              <AddCandidateForm requestId={id} suppliers={suppliers.map((s) => ({ id: s.id, name: s.name, relationship: s.relationship }))} units={units.filter((u) => !b.rideSlug || u.rideSlug === b.rideSlug)} />
              {suppliers.length === 0 && <p className="mt-2 text-xs text-muted">No suppliers in the directory. Run <code>npm run db:seed-demo</code> for fictional demo suppliers.</p>}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-lg">Customer quotes</h2>
            <ul className="mt-3 space-y-3">
              {quotes.map((q) => (
                <li key={q.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line p-3 text-sm">
                  <div className="max-w-lg">
                    <div className="text-xs text-muted">v{q.version} · {QUOTE_PRICE_LABEL[q.status]}</div>
                    <div className="font-display text-xl">{formatUsd(q.amountCents)}</div>
                    <p className="mt-1 whitespace-pre-line text-ink-soft">{q.scope}</p>
                  </div>
                  {q.status === "draft" && (r.fulfilmentStatus === "sourcing" || r.fulfilmentStatus === "quote_sent") && (
                    <ActionButton requestId={id} variant="primary" payload={{ action: "send_quote", quoteId: q.id }} label="Send to customer" confirmText="Send this quote? Any earlier open quote will be superseded." />
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-4"><CustomerQuoteForm requestId={id} /></div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-5">
            <h2 className="text-lg">Next action</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {teamMoves.map((s) => <ActionButton key={s} requestId={id} payload={{ action: "transition", to: s, note: null }} label={`→ ${FULFILMENT_LABELS[s].title}`} />)}
              {r.fulfilmentStatus === "supplier_committed" && (
                <ActionButton requestId={id} variant="primary" payload={{ action: "confirm_booking" }} label="Confirm booking" confirmText="Confirm this booking? The customer will see it as confirmed." />
              )}
            </div>
            {r.fulfilmentStatus === "supplier_committed" && (
              <p className="mt-3 text-xs text-muted">Confirmation requires an accepted quote, a committed supplier and payment status “{PAYMENT_LABELS[PAYMENT_POLICY.demoConfirmationRequires]}” (demo policy — real policy not yet decided).</p>
            )}
          </section>

          <section className="card p-5">
            <h2 className="text-lg">Projected contribution margin</h2>
            <p className="text-xs font-semibold text-warn">Projection only — not guaranteed profit.</p>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><dt>Customer price {priceQuote ? `(${QUOTE_PRICE_LABEL[priceQuote.status].toLowerCase()})` : ""}</dt><dd>{money(margin.customerPriceCents)}</dd></div>
              {margin.components.map((c) => <div key={c.label} className="flex justify-between text-ink-soft"><dt>− {c.label}</dt><dd>{money(c.cents)}</dd></div>)}
              <div className="flex justify-between border-t border-line pt-2 font-semibold">
                <dt>{margin.isComplete ? "Projected margin" : "Margin before unknown costs"}</dt>
                <dd>{money(margin.marginBeforeUnknownsCents)}</dd>
              </div>
            </dl>
            {basisSupplierId && <p className="mt-2 text-xs text-muted">Costs basis: {supplierName(basisSupplierId)}{committed ? " (committed)" : " (latest quote)"}.</p>}
            {margin.unknownComponents.length > 0 && <p className="mt-2 text-xs text-warn">Unknown: {margin.unknownComponents.join(", ")}. The real margin will be lower by these amounts.</p>}
          </section>

          <section className="card p-5">
            <h2 className="text-lg">Payment <span className="text-sm text-demo">(demo adapter)</span></h2>
            <p className="mt-1 text-xs text-muted">Records a state only. No card data, no Stripe call, no money moves.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {PAYMENT_STATUSES.filter((p) => canTransitionPayment(r.paymentStatus, p)).map((p) => (
                <ActionButton key={p} requestId={id} payload={{ action: "demo_payment", to: p, note: null }} label={`Demo: ${PAYMENT_LABELS[p]}`} />
              ))}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-lg">History</h2>
            <ol className="mt-3 space-y-2 text-xs">
              {events.map((e) => (
                <li key={e.id} className="border-l-2 border-line pl-3">
                  <span className="text-muted">{e.createdAt.slice(0, 16).replace("T", " ")} · {e.actor} · {e.track}</span>
                  <div>{e.toStatus ? `${e.fromStatus ?? "—"} → ${e.toStatus}` : ""} {e.note}</div>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
