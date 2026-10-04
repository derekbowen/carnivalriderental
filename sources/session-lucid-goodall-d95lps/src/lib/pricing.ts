// Price labels. An estimate and an accepted quote must never look alike.

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export type PriceLabelInput =
  | { kind: "estimate"; lowCents: number; highCents: number; placeholder: boolean }
  | { kind: "quote"; cents: number; status: "sent" | "accepted" }
  | { kind: "none" };

export type PriceLabel = { amount: string; label: string; tone: "estimate" | "quote" | "accepted" | "none" };

export function priceLabel(p: PriceLabelInput): PriceLabel {
  switch (p.kind) {
    case "estimate":
      return {
        amount: `${formatUsd(p.lowCents)}–${formatUsd(p.highCents)}`,
        label: p.placeholder
          ? "Placeholder estimate (development data) — not a quote"
          : "Estimate — your final price comes in a written quote after sourcing",
        tone: "estimate",
      };
    case "quote":
      return p.status === "accepted"
        ? { amount: formatUsd(p.cents), label: "Accepted quote", tone: "accepted" }
        : { amount: formatUsd(p.cents), label: "Quote sent — awaiting your acceptance", tone: "quote" };
    case "none":
      return { amount: "Priced on request", label: "We send a written quote after sourcing", tone: "none" };
  }
}
