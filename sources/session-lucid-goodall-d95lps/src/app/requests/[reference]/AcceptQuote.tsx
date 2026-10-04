"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AcceptQuote({ reference, token, quoteId }: { reference: string; token: string; quoteId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/requests/${encodeURIComponent(reference)}/accept-quote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, quoteId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Your decision was not saved. Please try again.");
      router.refresh(); // re-render from the stored state
    } catch (e) {
      setError(e instanceof Error ? e.message : "Your decision was not saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 border-t border-line pt-5">
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
        <span>I accept this scope and price. I understand the booking is confirmed only once an operator commits.</span>
      </label>
      <button type="button" className="btn-primary mt-4 w-full" onClick={accept} disabled={!agreed || busy}>
        {busy ? "Saving…" : "Accept quote"}
      </button>
      {error ? <p role="alert" className="mt-3 text-sm text-red-800">{error}</p> : null}
    </div>
  );
}
