import Image from "next/image";
import type { ImageRef } from "@/lib/catalog/types";
import { PlaceholderImage } from "./design/PlaceholderImage";

export function RideImage({ image, className = "", size = "md", priority }: { image: ImageRef; className?: string; size?: "sm" | "md" | "lg"; priority?: boolean }) {
  if (image.kind === "placeholder") {
    return <PlaceholderImage glyph={image.glyph} caption={image.alt} size={size} className={className} />;
  }
  return (
    <div className={`relative overflow-hidden bg-ink-soft ${className}`}>
      <Image src={image.src} alt={image.alt} fill priority={priority} sizes="(min-width: 1024px) 66vw, 100vw" className="object-cover" />
    </div>
  );
}
