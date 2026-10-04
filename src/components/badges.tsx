import { CalendarClockIcon, ShieldCheckIcon } from "lucide-react";
import type { PlanningEstimate } from "@/lib/content/types";
import { PRICE_COPY } from "@/lib/pricing/policy";
import { formatUsd } from "@/lib/requests/labels";

/** Availability is "Sourcing on request" unless a verified coverage record exists. */
export function AvailabilityBadge({ verified = false, className = "" }: { verified?: boolean; className?: string }) {
  return verified ? (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-ok-wash px-2.5 py-1 text-xs font-semibold text-ok ${className}`}>
      <ShieldCheckIcon className="h-3.5 w-3.5" aria-hidden="true" /> Verified equipment in this area
    </span>
  ) : (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-accent-wash px-2.5 py-1 text-xs font-semibold text-accent-strong ${className}`}>
      <CalendarClockIcon className="h-3.5 w-3.5" aria-hidden="true" /> Sourcing on request
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
export function EstimateLabel({ estimate, size = "sm" }: { estimate: PlanningEstimate | null; size?: "sm" | "lg" }) {
  if (!estimate) {
    return size === "lg" ? (
      <div>
        <p className="text-sm text-muted">Pricing</p>
        <p className="mt-1 font-display text-[30px] leading-tight">Tailored quote</p>
        <p className="mt-1 text-sm text-muted">We price each event after matching it to an operator.</p>
      </div>
    ) : (
      <div>
        <p className="text-[15px]"><span className="text-muted">Pricing </span><span className="font-semibold">Tailored quote</span></p>
        <p className="text-xs text-muted">(priced per event)</p>
      </div>
    );
  }
  const range = `${formatUsd(estimate.lowUsd * 100)} – ${formatUsd(estimate.highUsd * 100)}`;
  const demo = estimate.isDemoValue && <span className="ml-1 font-semibold text-demo">· DEMO VALUE</span>;
  return size === "lg" ? (
    <div>
      <p className="text-sm text-muted">{PRICE_COPY.estimateLabel}{demo}</p>
      <p className="mt-1 font-display text-[34px] leading-tight">{range}</p>
      <p className="mt-1 text-sm text-muted">{PRICE_COPY.notFinal} {estimate.basis}</p>
    </div>
  ) : (
    <div>
      <p className="text-[15px]"><span className="text-muted">{PRICE_COPY.estimateLabel} </span><span className="font-semibold">{range}</span></p>
      <p className="text-xs text-muted">{PRICE_COPY.notFinal}{demo}</p>
    </div>
  );
}
