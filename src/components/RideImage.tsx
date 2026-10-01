import type { ContentImage } from "@/lib/content/types";

export function RideImage({ image, className = "", priority = false }: { image: ContentImage; className?: string; priority?: boolean }) {
  return (
    <figure className={`relative overflow-hidden bg-line ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.src} alt={image.alt} className="h-full w-full object-cover" loading={priority ? "eager" : "lazy"} />
      {image.license === "dev-placeholder" && (
        <figcaption className="absolute left-3 top-3 rounded-full bg-ink/85 px-2.5 py-1 text-[11px] font-semibold text-white">
          Development placeholder image
        </figcaption>
      )}
    </figure>
  );
}
