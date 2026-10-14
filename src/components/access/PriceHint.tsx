"use client";

import { useEffect, useState } from "react";

/**
 * Price note under the ride-type selector. Server-rendered with the general sentence (both tiers),
 * then follows the select: choosing any Ferris wheel type shows the Ferris tier. Display only: the
 * tier that is charged is resolved on the server from the submitted request (lib/access/pricing).
 */
export function PriceHint({ standard, ferris, ferrisTypes }: { standard: string | null; ferris: string | null; ferrisTypes: string[] }) {
  const [selected, setSelected] = useState("");
  useEffect(() => {
    const el = document.getElementById("rideType") as HTMLSelectElement | null;
    if (!el) return;
    const update = () => setSelected(el.value);
    update();
    el.addEventListener("change", update);
    return () => el.removeEventListener("change", update);
  }, []);
  const isFerris = ferrisTypes.includes(selected);
  const general = [standard ? `Event Access is ${standard}.` : "Event Access isn't available right now.", ferris ? `Ferris Wheel Event Access is ${ferris}.` : null].filter(Boolean).join(" ");
  return (
    <p className="mt-1 text-xs text-muted" data-testid="price-note" data-tier={isFerris ? "ferris" : "standard"} aria-live="polite">
      {isFerris
        ? ferris
          ? `Ferris Wheel Event Access — ${ferris} applies to this request (any Ferris wheel type).`
          : "Ferris Wheel Event Access isn't available right now."
        : `${general} Ferris wheel requests (standard, giant or mini) use the Ferris tier. You'll see the exact amount after we count matching operators, before any payment.`}
    </p>
  );
}
