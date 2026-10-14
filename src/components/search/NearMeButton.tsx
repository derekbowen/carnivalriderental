"use client";

import { LocateFixedIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

/** Swaps the approximate (IP) location for the browser's exact one. Nothing is stored. */
export function NearMeButton() {
  const router = useRouter();
  const sp = useSearchParams();
  const [state, setState] = useState<"idle" | "busy" | "denied">("idle");
  return (
    <button
      type="button"
      className="btn-ghost min-h-11"
      disabled={state === "busy"}
      onClick={() => {
        if (!navigator.geolocation) return setState("denied");
        setState("busy");
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const q = new URLSearchParams(sp.toString());
            q.set("near", `${pos.coords.latitude.toFixed(2)},${pos.coords.longitude.toFixed(2)}`);
            q.delete("page");
            router.push(`/s?${q}`);
            setState("idle");
          },
          () => setState("denied"),
          { timeout: 10000, maximumAge: 600000 },
        );
      }}
    >
      <LocateFixedIcon className="h-4 w-4" aria-hidden="true" />
      {state === "busy" ? "Finding you…" : state === "denied" ? "Location blocked: using your area" : "Use my exact location"}
    </button>
  );
}
