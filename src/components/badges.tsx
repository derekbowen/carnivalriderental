import type { PlanningEstimate } from "@/lib/content/types";
import { formatUsd } from "@/lib/requests/labels";

/** Availability is "Sourcing on request" unless a verified coverage record exists. */
export function AvailabilityBadge({ verified = false }: { verified?: boolean }) {
  return verified ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-wash px-2.5 py-1 text-xs font-semibold text-ok">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ok" /> Verified equipment in this area
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-wash px-2.5 py-1 text-xs font-semibold text-warn">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" /> Sourcing on request
    </span>
  );
}

export function DemoBadge({ label = "Demo record" }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-demo-wash px-2.5 py-1 text-xs font-semibold text-demo" title="Development fixture — not publishable, not verified">
      {label}
    </span>
  );
}

/** A planning estimate is never a quote. The label says so every time it appears. */
export function EstimateLabel({ estimate, compact = false }: { estimate: PlanningEstimate | null; compact?: boolean }) {
  if (!estimate) {
    return (
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">Pricing</div>
        <div className="font-display text-lg">Tailored quote</div>
        {!compact && <p className="mt-1 text-xs text-muted">We price each event after matching it to an operator.</p>}
      </div>
    );
  }
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">
        Planning estimate {estimate.isDemoValue && <span className="text-demo">· DEMO VALUE</span>}
      </div>
      <div className="font-display text-lg">
        {formatUsd(estimate.lowUsd * 100)} – {formatUsd(estimate.highUsd * 100)}
      </div>
      <p className="mt-1 text-xs text-muted">Not a quote. {compact ? "" : estimate.basis}</p>
    </div>
  );
}
