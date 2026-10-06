import { MapPinIcon, ImageOffIcon, PhoneIcon, MailIcon, GlobeIcon, LockIcon, CheckIcon } from "lucide-react";
import Link from "next/link";
import type { MatchedOperator } from "@/lib/access/matching";
import type { Unlock } from "@/lib/access/service";
import { rideTypeCopy } from "@/lib/inventory/ride-type-copy";
import { paths } from "@/lib/seo/routes";

/** One matched operator: anonymous until unlocked. Contact fields render only from an unlock snapshot. */
export function OperatorMatch({ op, unlock, passId, usable, remaining, reported }: { op: MatchedOperator; unlock?: Unlock | null; passId?: string; usable?: boolean; remaining?: number; reported?: boolean }) {
  const c = unlock?.contact ?? null;
  return (
    <li id={`op-${op.operatorId}`} data-testid="operator-match" data-unlocked={c ? "1" : "0"} className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{c ? "Unlocked" : op.label}</p>
          <h3 className="mt-1 text-xl">{c ? c.companyName ?? "Operator" : `Carnival operator${op.homeState ? ` based in ${op.homeState}` : ""}`}</h3>
          <p className="mt-1 flex items-center gap-1 text-sm text-ink-soft"><MapPinIcon className="h-4 w-4" aria-hidden="true" />~{op.miles.toLocaleString("en-US")} mi from your event{op.servesState ? " · serves your state" : ""}{c?.hqCity ? ` · ${c.hqCity}${c.hqState ? `, ${c.hqState}` : ""}` : ""}</p>
        </div>
        {c ? <span className="inline-flex items-center gap-1 rounded-full bg-ok-wash px-2.5 py-1 text-xs font-semibold text-ok"><CheckIcon className="h-3.5 w-3.5" aria-hidden="true" /> Contact revealed</span> : <span className="inline-flex items-center gap-1 rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-muted"><LockIcon className="h-3.5 w-3.5" aria-hidden="true" /> Locked</span>}
      </div>

      <ul className="mt-4 flex gap-3 overflow-x-auto">
        {op.listings.map((l) => (
          <li key={l.id} className="w-36 shrink-0">
            <Link href={paths.rideListing(l.id)} className="block">
              {l.thumb || l.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.thumb ?? l.photo!} alt={l.title} className="aspect-[4/3] w-full rounded-lg object-cover" loading="lazy" />
              ) : (
                <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg bg-placeholder text-muted"><ImageOffIcon className="h-5 w-5" aria-hidden="true" /></div>
              )}
              <p className="mt-1 truncate text-xs font-medium">{l.title}</p>
              {l.rideType && <p className="truncate text-[11px] text-muted">{rideTypeCopy(l.rideType, l.rideType).label}</p>}
            </Link>
          </li>
        ))}
      </ul>

      {c ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-3" data-testid="revealed-contact">
          {c.phone && <a className="btn-dark justify-center" href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}><PhoneIcon className="h-4 w-4" aria-hidden="true" /> {c.phone}</a>}
          {c.email && <a className="btn-dark justify-center" href={`mailto:${c.email}`}><MailIcon className="h-4 w-4" aria-hidden="true" /> Email</a>}
          {c.website && <a className="btn-dark justify-center" href={c.website} target="_blank" rel="noopener noreferrer"><GlobeIcon className="h-4 w-4" aria-hidden="true" /> Website</a>}
          {c.contactName && <p className="text-sm text-ink-soft sm:col-span-3">Ask for {c.contactName}.</p>}
          <p className="text-xs text-muted sm:col-span-3">Agree price, date, delivery, crew, insurance and payment directly with this operator. Unlocked {unlock!.firstRevealedAt.slice(0, 10)}.</p>
          {passId && (
            reported || unlock?.reportedDeadAt ? (
              <p className="text-xs text-muted sm:col-span-3">Reported. We&rsquo;ll check this contact and may restore your unlock.</p>
            ) : (
              <form method="post" action={`/api/pass/${passId}/report`} className="sm:col-span-3">
                <input type="hidden" name="operator" value={op.operatorId} />
                <button type="submit" className="text-xs text-muted underline">This contact didn&rsquo;t work</button>
              </form>
            )
          )}
        </div>
      ) : passId ? (
        <form method="post" action={`/api/pass/${passId}/unlock`} className="mt-4">
          <input type="hidden" name="operator" value={op.operatorId} />
          <button type="submit" className="btn-primary" disabled={!usable || (remaining ?? 0) <= 0}>Unlock operator contact</button>
          <span className="ml-3 text-xs text-muted">Uses 1 of your remaining {remaining ?? 0}.</span>
        </form>
      ) : null}
    </li>
  );
}
