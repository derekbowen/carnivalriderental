// Ported from the Magic Patterns design (design/magic-patterns/components/
// PlaceholderImage.tsx). Every placeholder says so on the image itself.
import { RideGlyph, type GlyphKind } from "./RideGlyph";

type Props = {
  glyph: GlyphKind;
  caption?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  tone?: "night" | "dusk";
};

const glyphSize = { sm: "w-3/4", md: "w-3/5 max-w-[280px]", lg: "w-3/5 max-w-[440px]" };

export function PlaceholderImage({ glyph, caption, className = "", size = "md", tone = "night" }: Props) {
  return (
    <div
      role="img"
      aria-label={`Development placeholder image${caption ? `: ${caption}` : ""}`}
      className={`relative overflow-hidden ${tone === "night" ? "bg-ink-soft" : "bg-ink-3"} ${className}`}
    >
      <div className="absolute inset-x-0 bottom-0 h-[22%] bg-ink/40" aria-hidden="true" />
      <RideGlyph
        kind={glyph}
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-marquee/45 ${glyphSize[size]}`}
      />
      {caption && size !== "sm" ? <span className="absolute left-4 top-4 max-w-[80%] text-xs text-canvas/55">{caption}</span> : null}
      <span
        className={`absolute bottom-3 left-3 inline-flex items-center rounded-full bg-ink/85 font-medium uppercase text-canvas/80 ring-1 ring-canvas/15 ${
          size === "sm" ? "px-2 py-0.5 text-[8px] tracking-[0.08em]" : "px-2.5 py-1 text-[10px] tracking-[0.14em]"
        }`}
      >
        {size === "sm" ? "Placeholder" : "Development placeholder image"}
      </span>
    </div>
  );
}
