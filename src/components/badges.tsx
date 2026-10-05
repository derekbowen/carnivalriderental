import { CalendarClockIcon, ShieldCheckIcon } from "lucide-react";
import type { PlanningEstimate } from "@/lib/content/types";
import { REQUEST_A_QUOTE } from "@/lib/pricing/public-price";

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

/**
 * Public price slot for ride-type and demo records. Their planning estimates are category or
 * ride-size figures, not an operator's approved rate, so they are never displayed: the slot always
 * reads "Request a quote" (src/lib/pricing/public-price.ts). The record keeps its estimate privately.
 */
export function EstimateLabel({ size = "sm" }: { estimate?: PlanningEstimate | null; size?: "sm" | "lg" }) {
  return size === "lg" ? (
    <div>
      <p className="text-sm text-muted">Pricing</p>
      <p className="mt-1 font-display text-[30px] leading-tight">{REQUEST_A_QUOTE}</p>
      <p className="mt-1 text-sm text-muted">Priced per event by the operator for your date, location and site.</p>
    </div>
  ) : (
    <div>
      <p className="text-[15px] font-semibold">{REQUEST_A_QUOTE}</p>
      <p className="text-xs text-muted">Priced per event</p>
    </div>
  );
}
