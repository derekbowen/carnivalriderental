import { priceLabel, type PriceLabelInput } from "@/lib/pricing";

export function PriceTag({ price, size = "md" }: { price: PriceLabelInput; size?: "md" | "lg" }) {
  const p = priceLabel(price);
  const tone =
    p.tone === "accepted" ? "text-emerald-800" : p.tone === "quote" ? "text-sky-900" : "text-ink";
  return (
    <div>
      <div className={`font-display ${size === "lg" ? "text-3xl" : "text-xl"} ${tone}`}>{p.amount}</div>
      <div className={`mt-1 text-xs ${p.tone === "estimate" || p.tone === "none" ? "text-ink-muted" : tone}`}>{p.label}</div>
    </div>
  );
}
