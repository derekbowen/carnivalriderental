import Link from "next/link";
import { getRide } from "@/lib/content";
import { getRequestService } from "@/lib/requests";
import { briefDates, FULFILMENT_LABELS, PAYMENT_LABELS } from "@/lib/requests/labels";
import { outreachAllowed } from "@/lib/requests/state";
import type { FulfilmentStatus } from "@/lib/requests/types";

const NEXT_ACTION: Record<FulfilmentStatus, string> = {
  submitted: "Review brief",
  in_review: "Start sourcing",
  sourcing: "Contact suppliers / send quote",
  quote_sent: "Await customer",
  quote_accepted: "Secure supplier commitment",
  supplier_committed: "Complete payment step, then confirm",
  confirmed: "Coordinate event",
  unable_to_source: "—",
  declined: "—",
  cancelled: "—",
};

export default function QueuePage() {
  const requests = getRequestService().listRequests();
  return (
    <section className="card overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
          <tr>{["Reference", "Ride", "Event date", "Location", "Fulfilment", "Payment", "Next action"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">
          {requests.length === 0 && (
            <tr><td colSpan={7} className="px-4 py-10 text-center text-muted">No requests yet. Submit one from <Link className="underline" href="/request">/request</Link>.</td></tr>
          )}
          {requests.map((r) => (
            <tr key={r.id} className="hover:bg-canvas">
              <td className="px-4 py-3 font-mono"><Link className="underline" href={`/internal/requests/${r.id}`}>{r.reference}</Link>{r.isTestData && <span className="ml-2 text-xs text-demo">test</span>}</td>
              <td className="px-4 py-3">{r.brief.rideSlug ? getRide(r.brief.rideSlug)?.name ?? r.brief.rideSlug : <em className="text-muted">needs advice</em>}</td>
              <td className="px-4 py-3">{briefDates(r.brief)}</td>
              <td className="px-4 py-3">{r.brief.city}, {r.brief.state}</td>
              <td className="px-4 py-3">{FULFILMENT_LABELS[r.fulfilmentStatus].title}</td>
              <td className="px-4 py-3">{PAYMENT_LABELS[r.paymentStatus]} <span className="text-xs text-demo">(demo)</span></td>
              <td className="px-4 py-3 font-medium">{!outreachAllowed(r.paymentStatus) && !["confirmed", "unable_to_source", "declined", "cancelled"].includes(r.fulfilmentStatus) ? "Await payment (pay first)" : NEXT_ACTION[r.fulfilmentStatus]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
