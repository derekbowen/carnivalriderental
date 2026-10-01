import Link from "next/link";
import { getDb } from "@/lib/db";
import { catalog } from "@/lib/catalog";
import { listRequests } from "@/lib/requests/repo";
import { label } from "@/lib/requests/options";
import { StatusChip } from "./ui";

export const dynamic = "force-dynamic";

export default function Queue() {
  const rows = listRequests(getDb());
  return (
    <main className="container-page py-8">
      <h1 className="font-display text-3xl">Request queue</h1>
      <p className="mt-1 text-sm text-ink-muted">{rows.length} request{rows.length === 1 ? "" : "s"} · development database</p>
      {rows.length ? (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-ink-muted">
              <tr>
                {["Reference", "Event date", "Location", "Ride", "Budget", "Status", "Next action"].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line hover:bg-canvas">
                  <td className="px-3 py-3 font-medium"><Link className="underline" href={`/internal/requests/${r.id}`}>{r.reference}</Link></td>
                  <td className="px-3 py-3">{r.date_start}</td>
                  <td className="px-3 py-3">{r.city}, {r.state}</td>
                  <td className="px-3 py-3">{r.ride_slug ? catalog.ride(r.ride_slug)?.name ?? r.ride_slug : "Open"}</td>
                  <td className="px-3 py-3">{label("budget", r.budget)}</td>
                  <td className="px-3 py-3"><StatusChip status={r.fulfillment_status} /></td>
                  <td className="px-3 py-3 text-ink-muted">{r.next_action ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card mt-6 p-8 text-center text-sm text-ink-muted">No requests yet.</div>
      )}
    </main>
  );
}
