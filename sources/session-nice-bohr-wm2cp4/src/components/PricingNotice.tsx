import { PRICE_COPY, PRICING_POLICY } from "@/lib/pricing/policy";

/** "How pricing works" — the same four rules on every template that shows prices or a request CTA. */
export function PricingNotice({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  return (
    <section data-testid="pricing-notice" aria-labelledby="pricing-notice-heading" className={`rounded-2xl border border-line bg-surface p-5 ${className}`}>
      <h2 id="pricing-notice-heading" className={compact ? "text-lg" : "text-xl"}>How pricing works</h2>
      <ol className={`mt-3 grid gap-3 text-sm ${compact ? "" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
        {PRICE_COPY.steps.map((s, i) => (
          <li key={s.title}>
            <p className="font-semibold">{i + 1}. {s.title}</p>
            <p className="mt-0.5 text-ink-soft">
              {s.body}
              {"pendingNote" in s && !PRICING_POLICY.paymentsLive && <span className="text-muted"> {s.pendingNote}</span>}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
