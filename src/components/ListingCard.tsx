import { ArrowRightIcon, ImageOffIcon } from "lucide-react";
import Link from "next/link";
import { categoryIllustration, categoryLabel, type ListingCardModel } from "@/lib/catalog/card";
import { REQUEST_A_QUOTE } from "@/lib/pricing/public-price";
import { DemoBadge } from "./badges";

/**
 * THE listing card (category hubs, state hubs, occasion pages). Photo-led; quiet "Sourcing on request";
 * no promotional badges, ratings, favourites or instant-booking claims. Sample labels stay visible.
 */
export function ListingCard({ card }: { card: ListingCardModel }) {
  const illustration = card.photo ? null : categoryIllustration(card.categoryId);
  return (
    <article data-testid="listing-card" data-source={card.source} className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-placeholder">
        {card.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.photo.src} alt={card.photo.alt} className="h-full w-full object-cover" loading="lazy" />
        ) : illustration ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={illustration.src} alt={illustration.alt} className="h-full w-full object-cover" loading="lazy" />
            <span className="absolute bottom-2 left-2 rounded bg-ink/70 px-2 py-0.5 text-[11px] font-medium text-white">Illustration</span>
          </>
        ) : (
          <div role="img" aria-label="No photo yet" className="flex h-full w-full flex-col items-center justify-center gap-1 text-ink-soft">
            <ImageOffIcon className="h-6 w-6 opacity-60" aria-hidden="true" />
            <span className="text-xs">No photo yet</span>
          </div>
        )}
        {card.sampleLabel && <span className="absolute left-3 top-3"><DemoBadge label={card.sampleLabel} /></span>}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-semibold text-muted">{categoryLabel(card.categoryId)}</p>
        <h3 className="mt-1 text-[22px] leading-tight">{card.name}</h3>
        {card.description && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-soft">{card.description}</p>}
        {card.specs.length > 0 && (
          <dl className="mt-3 grid gap-1 text-sm">
            {card.specs.map((s) => (
              <div key={s.label} className="flex justify-between gap-3"><dt className="text-muted">{s.label}</dt><dd className="font-medium">{s.value}</dd></div>
            ))}
          </dl>
        )}
        <div className="mt-auto border-t border-line pt-4">
          {/* Card estimates are category figures, never an operator's approved rate (src/lib/pricing/public-price.ts). */}
          <p data-testid="card-request-pricing" className="text-[15px] font-semibold">{REQUEST_A_QUOTE}</p>
          <p className="text-xs text-muted">Priced per event by the operator.</p>
          <p className="mt-1 text-xs text-muted">Sourcing on request</p>
          {card.detail ? (
            <Link href={card.detail.href} className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent-strong hover:underline" aria-label={`View details: ${card.name}`}>
              {card.detail.kind === "preview" ? "View details (dev preview)" : "View details"} <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : (
            <p className="mt-3 text-xs text-muted">Details page in preparation</p>
          )}
        </div>
      </div>
    </article>
  );
}
