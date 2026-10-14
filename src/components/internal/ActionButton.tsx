"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Posts an internal action, then re-reads server state. Errors from server-side rules are shown verbatim. */
export function useInternalAction(requestId: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/internal/api/requests/${requestId}/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || body.issues?.[0]?.message || `Failed (${res.status})`);
      router.refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { run, busy, error };
}

export function ActionButton({ requestId, payload, label, variant = "ghost", confirmText }: { requestId: string; payload: Record<string, unknown>; label: string; variant?: "ghost" | "primary"; confirmText?: string }) {
  const { run, busy, error } = useInternalAction(requestId);
  return (
    <span className="inline-flex flex-col">
      <button className={variant === "primary" ? "btn-primary !py-2" : "btn-ghost !py-1.5 !text-xs"} disabled={busy} onClick={() => (!confirmText || confirm(confirmText)) && run(payload)}>{label}</button>
      {error && <span role="alert" className="mt-1 max-w-xs text-xs text-danger">{error}</span>}
    </span>
  );
}
