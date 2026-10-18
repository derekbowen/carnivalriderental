import Link from "next/link";
import { accessDb } from "@/lib/access/db";
import { formatPrice } from "@/lib/access/config";
import { BRAND } from "@/lib/config";
import { leadsReport, type Lead, type LeadOutcome } from "@/lib/lifecycle/leads";

export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90];
const OUTCOME: Record<LeadOutcome, { label: string; tone: string }> = {
  paid: { label: "Bought", tone: "bg-ok-wash text-ok" },
  refunded: { label: "Refunded", tone: "bg-canvas text-muted" },
  checkout_open: { label: "In checkout", tone: "bg-accent-wash text-ink" },
  checkout_abandoned: { label: "Left checkout", tone: "bg-accent-wash text-ink" },
  not_bought: { label: "Didn't buy", tone: "bg-canvas text-ink" },
  not_sellable: { label: "Too few operators", tone: "bg-danger-wash text-danger" },
};

const day = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });
const eventDay = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** A one-to-one reply to someone who searched with us; the subject names their own request. */
const replyHref = (l: Lead) => `mailto:${l.email}?subject=${encodeURIComponent(`Your ${l.ride} search for ${l.city}, ${l.state} (${BRAND.name})`)}`;

function What({ l }: { l: Lead }) {
  const next = l.manualSearchRequested ? "asked us to search by hand" : l.alternativePicked ? "picked an alternative" : l.alternativesShown ? "shown alternatives" : null;
  return (
    <div className="space-y-1">
      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${OUTCOME[l.outcome].tone}`}>{OUTCOME[l.outcome].label}</span>
      <p className="text-xs text-muted">{l.matched} operator{l.matched === 1 ? "" : "s"} matched{next ? ` · ${next}` : ""}{l.liveCents ? ` · ${formatPrice(l.liveCents, "usd")}` : ""}</p>
    </div>
  );
}

/**
 * Every Event Access search, newest first, for following up by hand. Customer details only (what
 * they typed); operator identity is never read here. Team test searches are hidden unless asked for.
 */
export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ days?: string; team?: string }> }) {
  const sp = await searchParams;
  const days = RANGES.includes(Number(sp.days)) ? Number(sp.days) : 30;
  const showTeam = sp.team === "1";
  let leads: Lead[] | null = null;
  try { leads = await leadsReport(await accessDb(), days); } catch { /* no ledger on this environment */ }
  const shown = (leads ?? []).filter((l) => showTeam || !l.team);
  const hiddenTeam = (leads ?? []).length - shown.length;
  const href = (d: number, team: boolean) => `/internal/leads?days=${d}${team ? "&team=1" : ""}`;
  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl">Leads</h1>
        <nav aria-label="Range" className="flex flex-wrap gap-3 text-sm">
          {RANGES.map((d) => <Link key={d} href={href(d, showTeam)} className={d === days ? "font-semibold" : "underline"}>Last {d} days</Link>)}
          <Link href={href(days, !showTeam)} className="underline">{showTeam ? "Hide our test searches" : `Show our test searches${hiddenTeam ? ` (${hiddenTeam})` : ""}`}</Link>
        </nav>
      </div>
      <p className="mt-1 text-sm text-muted">
        Every search on the Connect form and in the chat, with what we could offer and what happened next. Reply to a lead by hand from its email link; follow-up emails only go out automatically for searches we could sell. Times are Pacific.
      </p>
      {!leads && <p className="card mt-4 p-4 text-sm">The access ledger is not configured on this environment.</p>}
      {leads && (
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm" data-testid="leads">
            <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
              <tr>{["Received", "Customer", "Event", "Ride", "Outcome", "Came from", "Follow-ups"].map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line align-top">
              {shown.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted">No searches in this range.</td></tr>}
              {shown.map((l) => (
                <tr key={l.id} data-testid="lead" data-outcome={l.outcome}>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">{day(l.createdAt)}{l.team && <span className="ml-1 text-xs text-muted">(test)</span>}</td>
                  <td className="px-4 py-3"><a href={replyHref(l)} className="font-medium underline">{l.email}</a><p className="text-xs text-muted">via {l.via}</p></td>
                  <td className="px-4 py-3">
                    <p>{l.eventType ? l.eventType.charAt(0).toUpperCase() + l.eventType.slice(1) : "Event"} · {eventDay(l.eventDate)}</p>
                    <p className="text-xs text-muted">{l.city}, {l.state}{l.zip ? ` ${l.zip}` : ""}{l.attendance ? ` · ${l.attendance.toLocaleString("en-US")} people` : ""}{l.budgetCents ? ` · budget ${formatPrice(l.budgetCents, "usd")}` : ""}</p>
                  </td>
                  <td className="px-4 py-3">{l.ride}</td>
                  <td className="px-4 py-3"><What l={l} /></td>
                  <td className="px-4 py-3 text-xs">
                    <p>{l.campaign ? [l.campaign.source, l.campaign.medium, l.campaign.campaign].filter(Boolean).join(" / ") : "(untagged)"}</p>
                    {l.sourcePath && <p className="mt-0.5 break-all text-muted">{l.sourcePath}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">{l.emails.length ? l.emails.map((e) => <p key={e}>{e}</p>) : "None"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
