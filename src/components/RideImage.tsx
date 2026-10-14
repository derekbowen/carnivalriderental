import { ImageIcon } from "lucide-react";
import type { ContentImage } from "@/lib/content/types";

/** Neutral, clearly labelled block used wherever we have no owned/licensed photo. */
export function PlaceholderImage({ label, className = "", compact = false }: { label?: string; className?: string; compact?: boolean }) {
  return (
    <div
      role="img"
      aria-label={`Development placeholder image${label ? `: ${label}` : ""}`}
      className={`relative flex items-center justify-center overflow-hidden bg-placeholder text-ink-soft ${className}`}
    >
      <div className="flex flex-col items-center gap-1.5 px-4 text-center">
        <ImageIcon className={compact ? "h-4 w-4 opacity-60" : "h-6 w-6 opacity-60"} aria-hidden="true" />
        {!compact && (
          <>
            <span className="text-[11px] font-medium uppercase tracking-[0.12em]">Development placeholder image</span>
            {label && <span className="text-xs opacity-80">{label}</span>}
          </>
        )}
      </div>
    </div>
  );
}

export function RideImage({ image, className = "", priority = false, compact = false, label }: { image: ContentImage; className?: string; priority?: boolean; compact?: boolean; label?: string }) {
  if (image.license === "dev-placeholder") return <PlaceholderImage label={label} className={className} compact={compact} />;
  return (
    <figure className={`relative overflow-hidden bg-placeholder ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.src} alt={image.alt} className="h-full w-full object-cover" loading={priority ? "eager" : "lazy"} />
      {image.credit && <figcaption className="absolute bottom-2 right-2 rounded bg-ink/70 px-2 py-0.5 text-[10px] text-white">{image.credit}</figcaption>}
    </figure>
  );
}
