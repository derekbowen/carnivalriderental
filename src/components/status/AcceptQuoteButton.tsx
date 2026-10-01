"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AcceptQuoteButton({ reference, token, quoteId, amount }: { reference: string; token: string; quoteId: string; amount: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function accept() {
    if (busy || !confirm(`Accept this quote for ${amount}? This does not by itself confirm the booking.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/requests/${encodeURIComponent(reference)}/accept-quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, quoteId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.ok !== true) throw new Error(body.message || "Could not accept the quote. Please refresh and try again.");
      router.refresh(); // re-read the persisted state; no optimistic success
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button className="btn-primary" onClick={accept} disabled={busy}>{busy ? "Accepting…" : `Accept quote (${amount})`}</button>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
