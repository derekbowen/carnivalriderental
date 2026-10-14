import { bothTiersSentence } from "@/lib/access/copy";
import { accessProductsForDisplay } from "@/lib/access/runtime";
import { PRICE_COPY } from "@/lib/pricing/policy";

/**
 * The customer pricing rules, in the same words on every page. The Event Access step names both
 * tiers from the product rows (never a literal price), so a database price change shows everywhere.
 */
export async function PricingNotice({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  const tiers = bothTiersSentence(await accessProductsForDisplay());
  return (
    <section data-testid="pricing-notice" aria-labelledby="pricing-notice-heading" className={`rounded-2xl border border-line bg-surface p-5 ${className}`}>
      <h2 id="pricing-notice-heading" className={compact ? "text-lg" : "text-xl"}>How pricing works</h2>
      <ol className={`mt-3 grid gap-3 text-sm ${compact ? "" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
        {PRICE_COPY.steps.map((s, i) => (
          <li key={s.title}>
            <p className="font-semibold">{i + 1}. {s.title}</p>
            <p className="mt-0.5 text-ink-soft">{s.body}{s.title.startsWith("Event Access") ? ` ${tiers}` : ""}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
