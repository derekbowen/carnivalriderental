import type { ReactNode } from "react";

/** Shown on any page built from development fixture data. */
export function FixtureBanner() {
  return (
    <div role="note" className="border-b border-amber-300 bg-amber-50 text-amber-900">
      <div className="container-page py-2 text-xs sm:text-sm">
        <strong>Development data.</strong> This page uses demo records. It is not verified inventory, not a partner
        commitment and not a real price. It is excluded from search indexing and the sitemap.
      </div>
    </div>
  );
}

export function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "gold" | "green" | "amber" | "blue" }) {
  const tones = {
    neutral: "bg-ink/5 text-ink-muted",
    gold: "bg-marquee-soft text-marquee-deep",
    green: "bg-emerald-50 text-emerald-800",
    amber: "bg-amber-50 text-amber-900",
    blue: "bg-sky-50 text-sky-900",
  } as const;
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function SourcingChip() {
  return <Chip tone="gold">Sourced on request — availability confirmed in your quote</Chip>;
}
