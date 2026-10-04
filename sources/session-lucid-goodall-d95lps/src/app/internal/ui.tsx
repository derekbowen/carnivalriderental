import type { FulfillmentStatus } from "@/lib/requests/status";

const TONE: Record<FulfillmentStatus, string> = {
  submitted: "bg-amber-50 text-amber-900",
  sourcing: "bg-sky-50 text-sky-900",
  quote_sent: "bg-indigo-50 text-indigo-900",
  quote_accepted: "bg-violet-50 text-violet-900",
  supplier_committed: "bg-emerald-50 text-emerald-900",
  confirmed: "bg-emerald-600 text-white",
  cancelled: "bg-ink/10 text-ink-muted",
};

export function StatusChip({ status }: { status: FulfillmentStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${TONE[status]}`}>{status.replace("_", " ")}</span>;
}
