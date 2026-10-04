import { OperatorApplications } from "@/lib/operators/applications";
import { getDb } from "@/lib/requests/db";

export const dynamic = "force-dynamic";

/** Early-access applications from the /operators page. Contact details are third-party data: team only. */
export default function OperatorApplicationsPage() {
  const apps = new OperatorApplications(getDb()).list();
  return (
    <section>
      <h1 className="text-2xl">Operator applications</h1>
      <p className="mt-1 text-sm text-muted">Applications are not accounts or listings. Nobody has been contacted automatically.</p>
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
            <tr>{["Company", "Contact", "Home base", "Serves", "Rides", "Received"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {apps.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted">No applications yet.</td></tr>}
            {apps.map(({ id, application: a, submissions, createdAt }) => (
              <tr key={id} className="align-top">
                <td className="px-4 py-3 font-medium">{a.companyName}{a.website && <div className="text-xs text-muted">{a.website}</div>}</td>
                <td className="px-4 py-3">{a.contactName}<div className="text-xs text-muted">{a.email} · {a.phone}</div></td>
                <td className="px-4 py-3 uppercase">{a.homeState}</td>
                <td className="px-4 py-3 uppercase">{a.statesServed.join(", ") || "—"}</td>
                <td className="max-w-xs whitespace-pre-wrap px-4 py-3">{a.rides}</td>
                <td className="px-4 py-3 text-xs text-muted">{createdAt.slice(0, 10)}{submissions > 1 && ` · updated ${submissions - 1}×`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
