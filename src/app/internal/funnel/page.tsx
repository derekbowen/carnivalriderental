import Link from "next/link";
import { accessDb } from "@/lib/access/db";
import { formatPrice } from "@/lib/access/config";
import { stripeMode } from "@/lib/access/stripe";
import { funnelReport, type FunnelReport } from "@/lib/lifecycle/report";
import { LIFECYCLE_EVENTS } from "@/lib/lifecycle/events";

export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90];
const LABELS: Record<string, string> = {
  chat_started: "Chat started",
  email_capture_offered: "Email offered",
  email_capture_accepted: "Email given",
  search_submitted: "Search",
  listing_viewed: "Listing viewed",
  event_access_offered: "Access offered",
  checkout_started: "Checkout started",
  event_access_purchased: "Purchased",
  operator_unlocked: "Operator unlocked",
};

function Table({ head, rows, empty }: { head: string[]; rows: (string | number)[][]; empty: string }) {
  return (
    <div className="card mt-3 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
          <tr>{head.map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.length === 0 && <tr><td colSpan={head.length} className="px-4 py-6 text-center text-muted">{empty}</td></tr>}
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-4 py-2 tabular-nums">{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

/** Funnel counts from the ledger's own records. Aggregates only: no emails, messages or contacts. */
export default async function FunnelPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const requested = Number((await searchParams).days);
  const days = RANGES.includes(requested) ? requested : 30;
  let report: FunnelReport | null = null;
  try { report = await funnelReport(await accessDb(), days); } catch { /* no ledger on this environment */ }
  const stripe = stripeMode();
  const usd = (c: number) => formatPrice(c, "usd");
  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl">Funnel</h1>
        <nav aria-label="Range" className="flex gap-3 text-sm">
          {RANGES.map((d) => <Link key={d} href={`/internal/funnel?days=${d}`} className={d === days ? "font-semibold" : "underline"}>Last {d} days</Link>)}
        </nav>
      </div>
      <p className="mt-1 text-sm text-muted">
        From the access ledger: lifecycle events, availability requests, purchases and lifecycle emails. Visits, traffic sources and campaign (utm) tags are in Vercel → Analytics.
        {" "}Stripe: <strong>{stripe.kind === "real" ? (stripe.live ? "live" : "test mode") : stripe.kind === "fake" ? "fake (development)" : "checkout closed"}</strong>.
      </p>
      {!report && <p className="card mt-4 p-4 text-sm">The access ledger is not configured on this environment.</p>}
      {report && (
        <>
          {report.unavailable.length > 0 && <p className="card mt-4 p-4 text-sm">Not readable here: {report.unavailable.join(", ")} (run <code>npm run access:migrate -- --concierge</code>).</p>}
          <h2 className="mt-6 text-xl">Events</h2>
          <Table
            head={["Event", "Source", "Count", "Chat sessions", "With reminder consent"]}
            rows={report.events.map((e) => [LABELS[e.name] ?? e.name, e.source, e.count, e.source === "chat" ? e.sessions : "—", e.name === "email_capture_accepted" ? e.consented : "—"])}
            empty="No events in this range."
          />
          <h2 className="mt-6 text-xl">By day</h2>
          <Table
            head={["Day", ...LIFECYCLE_EVENTS.map((n) => LABELS[n])]}
            rows={report.daily.map((d) => [d.day, ...LIFECYCLE_EVENTS.map((n) => d.counts[n] ?? 0)])}
            empty="No events in this range."
          />
          <h2 className="mt-6 text-xl">Purchases</h2>
          <Table
            head={["Product", "Status", "Count", "Live revenue (net of refunds)", "Test-mode amount"]}
            rows={report.purchases.map((p) => [p.productId, p.status, p.count, usd(p.liveCents), usd(p.testCents)])}
            empty="No purchases in this range."
          />
          <p className="mt-2 text-xs text-muted">Only live-mode Stripe sessions count as revenue; test-mode and fake payments are shown separately and are not real money.</p>
          <h2 className="mt-6 text-xl">Availability requests</h2>
          <Table head={["Status", "Count"]} rows={report.availabilityRequests.map((r) => [r.status, r.count])} empty="No availability requests in this range." />
          <h2 className="mt-6 text-xl">Lifecycle emails</h2>
          <Table head={["Template", "Status", "Count"]} rows={report.emails.map((e) => [e.template, e.status, e.count])} empty="No lifecycle emails in this range." />
        </>
      )}
    </section>
  );
}
