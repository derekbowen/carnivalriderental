"use client";

import { useState } from "react";
import { useInternalAction } from "./ActionButton";

const toCents = (s: string): number | null => (s.trim() === "" ? null : Math.round(Number(s) * 100));

export function AddCandidateForm({ requestId, suppliers, units }: { requestId: string; suppliers: { id: string; name: string; relationship: string }[]; units: { id: string; supplierId: string; description: string }[] }) {
  const { run, busy, error } = useInternalAction(requestId);
  const [supplierId, setSupplierId] = useState("");
  const [unitId, setUnitId] = useState("");
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={async (e) => { e.preventDefault(); if (await run({ action: "add_candidate", supplierId, unitId: unitId || null, notes: null })) { setSupplierId(""); setUnitId(""); } }}>
      <select className="input !w-auto !py-1.5 text-sm" required value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setUnitId(""); }}>
        <option value="">Choose supplier…</option>
        {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.relationship.replace(/_/g, " ")}</option>)}
      </select>
      <select className="input !w-auto !py-1.5 text-sm" value={unitId} onChange={(e) => setUnitId(e.target.value)} disabled={!supplierId}>
        <option value="">Unit (optional)</option>
        {units.filter((u) => u.supplierId === supplierId).map((u) => <option key={u.id} value={u.id}>{u.description}</option>)}
      </select>
      <button className="btn-ghost !py-1.5 !text-xs" disabled={busy || !supplierId}>Add candidate</button>
      {error && <p role="alert" className="w-full text-xs text-danger">{error}</p>}
    </form>
  );
}

export function SupplierQuoteForm({ requestId, supplierId }: { requestId: string; supplierId: string }) {
  const { run, busy, error } = useInternalAction(requestId);
  const [v, setV] = useState({ price: "", transport: "", crew: "", other: "", notes: "" });
  const field = (k: keyof typeof v, label: string) => (
    <label className="text-xs"><span className="text-muted">{label}</span><input className="input !py-1.5" inputMode="decimal" placeholder="Unknown" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></label>
  );
  return (
    <form className="mt-3 grid gap-2 rounded-lg bg-canvas p-3 sm:grid-cols-5" onSubmit={(e) => { e.preventDefault(); run({ action: "record_supplier_quote", supplierId, supplierPriceCents: toCents(v.price), transportCents: toCents(v.transport), crewCents: toCents(v.crew), otherCents: toCents(v.other), notes: v.notes || null }); }}>
      {field("price", "Supplier quote $")}
      {field("transport", "Transport $")}
      {field("crew", "Setup/crew $")}
      {field("other", "Other $")}
      <div className="flex items-end"><button className="btn-ghost !py-1.5 !text-xs w-full" disabled={busy}>Record quote</button></div>
      <p className="text-[11px] text-muted sm:col-span-5">Leave blank for unknown. Blank is recorded as unknown, never as $0.</p>
      {error && <p role="alert" className="text-xs text-danger sm:col-span-5">{error}</p>}
    </form>
  );
}

export function CustomerQuoteForm({ requestId }: { requestId: string }) {
  const { run, busy, error } = useInternalAction(requestId);
  const [amount, setAmount] = useState("");
  const [scope, setScope] = useState("");
  return (
    <form className="space-y-2" onSubmit={async (e) => { e.preventDefault(); const c = toCents(amount); if (c && (await run({ action: "create_quote", amountCents: c, scope }))) { setAmount(""); setScope(""); } }}>
      <input className="input" inputMode="decimal" placeholder="Customer price (USD)" required value={amount} onChange={(e) => setAmount(e.target.value)} />
      <textarea className="input" rows={3} required placeholder="Scope: ride, operating crew, hours, days, transport, setup/teardown, exclusions, payment terms…" value={scope} onChange={(e) => setScope(e.target.value)} />
      <button className="btn-ghost !py-1.5 !text-xs" disabled={busy}>Save draft quote</button>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </form>
  );
}
