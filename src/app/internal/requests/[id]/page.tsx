import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { catalog } from "@/lib/catalog";
import {
  assignments,
  customerQuotes,
  getRequest,
  latestSupplierQuote,
  listSuppliers,
  projectContribution,
  requestHistory,
  supplierQuotes,
} from "@/lib/requests/repo";
import { label } from "@/lib/requests/options";
import { MANUAL_TRANSITIONS, PAYMENT_LABEL, CONFIRMATION_PAYMENT_POLICY } from "@/lib/requests/status";
import { formatUsd } from "@/lib/pricing";
import { StatusChip } from "../../ui";
import {
  AddSupplierForm,
  NextActionForm,
  SendQuoteForm,
  StageForm,
  StatusForm,
  SupplierQuoteForm,
  SupplierStatusForm,
  WithdrawQuoteButton,
} from "./forms";

export const dynamic = "force-dynamic";

const money = (c: number | null | undefined) => (c === null || c === undefined ? "Unknown" : formatUsd(c));

export default async function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const r = getRequest(db, id);
  if (!r) notFound();
  const as = assignments(db, id);
  const quotes = customerQuotes(db, id);
  const openOrAccepted = quotes.find((q) => q.status === "sent" || q.status === "accepted");
  const suppliers = listSuppliers(db);
  const hist = requestHistory(db, id);
  const ride = r.ride_slug ? catalog.ride(r.ride_slug) : undefined;
  const allowed = MANUAL_TRANSITIONS[r.fulfillment_status] ?? [];

  return (
    <main className="container-page py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl">{r.reference}</h1>
        <StatusChip status={r.fulfillment_status} />
        <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs">Payment: {PAYMENT_LABEL[r.payment_status]}</span>
      </div>
      <p className="mt-1 text-sm text-ink-muted">Received {new Date(r.created_at).toLocaleString("en-US")}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <section className="card p-5">
            <h2 className="font-semibold">Event brief</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {[
                ["Ride", ride?.name ?? (r.ride_slug || "Open — suggest options")],
                ["Ride flexibility", label("rideFlexibility", r.ride_flexibility)],
                ["Dates", `${r.date_start}${r.date_end ? ` → ${r.date_end}` : ""} (${label("dateFlexibility", r.date_flexibility)})`],
                ["Location", `${r.city}, ${r.state}${r.venue ? ` · ${r.venue}` : ""}`],
                ["Hours", r.operating_hours ?? "—"],
                ["Event", `${label("eventType", r.event_type)} · ${label("expectedAttendance", r.expected_attendance)}`],
                ["Budget", label("budget", r.budget)],
                ["Site access", label("siteAccess", r.site_access)],
                ["Space", label("availableSpace", r.available_space)],
                ["Power", label("power", r.power)],
                ["Contact", `${r.contact_name} · ${r.contact_email}${r.contact_phone ? ` · ${r.contact_phone}` : ""}`],
                ["Organization", r.organization ?? "—"],
              ].map(([k, v]) => (
                <div key={k}><dt className="text-ink-muted">{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
            {r.notes ? <p className="mt-3 whitespace-pre-line rounded bg-canvas p-3 text-sm">{r.notes}</p> : null}
          </section>

          <section className="card p-5">
            <h2 className="font-semibold">Suppliers for this event</h2>
            <p className="mt-1 text-xs text-ink-muted">
              Supplier status (researched → contacted → verified) is about the business. Stage is about this event. Only
              a verified supplier with a recorded quote can be committed.
            </p>
            {as.length ? (
              <div className="mt-4 space-y-4">
                {as.map((a) => {
                  const latest = latestSupplierQuote(db, a.id);
                  const history = supplierQuotes(db, a.id);
                  const proj = projectContribution(openOrAccepted?.price_cents ?? null, latest);
                  return (
                    <div key={a.id} className="rounded-lg border border-line p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-medium">{a.supplier_name}</div>
                        <div className="flex flex-wrap items-center gap-2">
                          <SupplierStatusForm requestId={id} supplierId={a.supplier_id} status={a.supplier_status} />
                          <StageForm requestId={id} assignmentId={a.id} stage={a.stage} />
                        </div>
                      </div>
                      <table className="mt-3 w-full text-sm">
                        <tbody>
                          {[
                            ["Supplier quote", money(latest?.supplier_quote_cents)],
                            ["Transport & mobilization", money(latest?.transport_cents)],
                            ["Setup, teardown & crew", money(latest?.crew_cents)],
                            ["Other fulfillment costs", money(latest?.other_cents)],
                            ["Payment costs", "Unknown (payment policy not decided)"],
                            ["Customer price (current quote)", money(openOrAccepted?.price_cents)],
                          ].map(([k, v]) => (
                            <tr key={k} className="border-t border-line">
                              <td className="py-1.5 text-ink-muted">{k}</td>
                              <td className={`py-1.5 text-right ${v.startsWith("Unknown") ? "text-amber-800" : ""}`}>{v}</td>
                            </tr>
                          ))}
                          <tr className="border-t border-line font-medium">
                            <td className="py-1.5">Projected contribution (not guaranteed)</td>
                            <td className="py-1.5 text-right">{proj.cents === null ? "Not enough data" : formatUsd(proj.cents)}</td>
                          </tr>
                        </tbody>
                      </table>
                      {proj.unknown.length ? (
                        <p className="mt-1 text-xs text-amber-800">Excludes unknown: {proj.unknown.join(", ")}.</p>
                      ) : null}
                      {latest?.scope ? <p className="mt-2 text-xs text-ink-muted">Supplier scope (v{latest.version}): {latest.scope}</p> : null}
                      {history.length > 1 ? <p className="mt-1 text-xs text-ink-muted">{history.length} quote versions recorded.</p> : null}
                      <SupplierQuoteForm requestId={id} assignmentId={a.id} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-sm text-ink-muted">No suppliers on this request yet.</p>
            )}
            <AddSupplierForm requestId={id} suppliers={suppliers.filter((s) => !as.some((a) => a.supplier_id === s.id)).map((s) => ({ id: s.id, name: s.name, status: s.status }))} />
          </section>

          <section className="card p-5">
            <h2 className="font-semibold">Customer quotes</h2>
            {quotes.length ? (
              <ul className="mt-3 divide-y divide-line text-sm">
                {quotes.map((q) => (
                  <li key={q.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
                    <div>
                      <div className="font-medium">v{q.version} · {formatUsd(q.price_cents)} · <span className="uppercase text-xs">{q.status}</span></div>
                      <div className="whitespace-pre-line text-ink-muted">{q.scope}</div>
                    </div>
                    <div className="text-xs text-ink-muted">{q.accepted_at ? `Accepted ${q.accepted_at.slice(0, 10)}` : q.sent_at ? `Sent ${q.sent_at.slice(0, 10)}` : ""}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">No quotes sent.</p>
            )}
            {["sourcing", "quote_sent"].includes(r.fulfillment_status) ? <SendQuoteForm requestId={id} revising={r.fulfillment_status === "quote_sent"} /> : null}
            {r.fulfillment_status === "quote_sent" ? <WithdrawQuoteButton requestId={id} /> : null}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-5">
            <h2 className="font-semibold">Status</h2>
            <StatusForm requestId={id} options={allowed} />
            {r.fulfillment_status === "supplier_committed" && !CONFIRMATION_PAYMENT_POLICY.approved ? (
              <p className="mt-3 rounded bg-amber-50 p-2 text-xs text-amber-900">Confirmation is disabled until a payment policy is approved (docs/DECISIONS.md).</p>
            ) : null}
            <p className="mt-3 text-xs text-ink-muted">“Quote sent” and “Quote accepted” happen through the quote itself, never by hand.</p>
          </section>
          <section className="card p-5">
            <h2 className="font-semibold">Next action</h2>
            <NextActionForm requestId={id} value={r.next_action ?? ""} />
          </section>
          <section className="card p-5">
            <h2 className="font-semibold">History</h2>
            <ol className="mt-3 space-y-2 text-xs">
              {hist.map((h) => (
                <li key={h.id}>
                  <span className="text-ink-muted">{h.created_at.replace("T", " ").slice(0, 16)}</span> · {h.actor} ·{" "}
                  {h.kind === "status" ? `${h.from_status ?? "—"} → ${h.to_status}` : h.note}
                  {h.kind === "status" && h.note ? ` (${h.note})` : ""}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </main>
  );
}
