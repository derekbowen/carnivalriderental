"use client";

import { useActionState } from "react";
import {
  addSupplier,
  addSupplierQuote,
  changeStage,
  changeStatus,
  changeSupplierStatus,
  sendQuote,
  updateNextAction,
  withdrawQuote,
  type ActionState,
} from "../../actions";

function Result({ s }: { s: ActionState }) {
  if (s.error) return <p role="alert" className="mt-2 text-xs text-red-700">{s.error}</p>;
  if (s.ok) return <p className="mt-2 text-xs text-emerald-700">{s.ok}</p>;
  return null;
}

export function StatusForm({ requestId, options }: { requestId: string; options: string[] }) {
  const [s, act, pending] = useActionState(changeStatus.bind(null, requestId), {});
  if (!options.length) return <p className="mt-2 text-sm text-ink-muted">No manual changes available from here.</p>;
  return (
    <form action={act} className="mt-3 space-y-2">
      <select name="to" className="field" defaultValue="">
        <option value="" disabled>Move to…</option>
        {options.map((o) => <option key={o} value={o}>{o.replace("_", " ")}</option>)}
      </select>
      <input name="note" className="field" placeholder="Note (optional)" />
      <button className="btn-primary w-full py-2" disabled={pending}>Update status</button>
      <Result s={s} />
    </form>
  );
}

export function NextActionForm({ requestId, value }: { requestId: string; value: string }) {
  const [s, act, pending] = useActionState(updateNextAction.bind(null, requestId), {});
  return (
    <form action={act} className="mt-3 space-y-2">
      <input name="nextAction" className="field" defaultValue={value} maxLength={300} />
      <button className="btn-secondary w-full py-2" disabled={pending}>Save</button>
      <Result s={s} />
    </form>
  );
}

export function AddSupplierForm({ requestId, suppliers }: { requestId: string; suppliers: { id: string; name: string; status: string }[] }) {
  const [s, act, pending] = useActionState(addSupplier.bind(null, requestId), {});
  return (
    <form action={act} className="mt-5 grid gap-2 rounded-lg bg-canvas p-3 sm:grid-cols-2">
      <select name="supplierId" className="field sm:col-span-2" defaultValue="">
        <option value="">Add an existing supplier…</option>
        {suppliers.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.status})</option>)}
      </select>
      <input name="newName" className="field" placeholder="…or new supplier business name" />
      <input name="region" className="field" placeholder="Region (optional)" />
      <input name="contact" className="field sm:col-span-2" placeholder="Contact notes (optional — no outreach is sent)" />
      <button className="btn-secondary py-2 sm:col-span-2" disabled={pending}>Add to this request</button>
      <div className="sm:col-span-2"><Result s={s} /></div>
    </form>
  );
}

export function SupplierStatusForm({ requestId, supplierId, status }: { requestId: string; supplierId: string; status: string }) {
  const [s, act, pending] = useActionState(changeSupplierStatus.bind(null, requestId, supplierId), {});
  return (
    <form action={act} className="flex items-center gap-1">
      <select name="status" defaultValue={status} className="rounded border border-line px-2 py-1 text-xs" aria-label="Supplier status">
        {["researched", "contacted", "verified"].map((o) => <option key={o} value={o}>Supplier: {o}</option>)}
      </select>
      <button className="rounded border border-line px-2 py-1 text-xs" disabled={pending}>Set</button>
      {s.error ? <span role="alert" className="text-xs text-red-700">{s.error}</span> : null}
      {s.ok ? <span className="text-xs text-emerald-700">{s.ok}</span> : null}
    </form>
  );
}

export function StageForm({ requestId, assignmentId, stage }: { requestId: string; assignmentId: string; stage: string }) {
  const [s, act, pending] = useActionState(changeStage.bind(null, requestId, assignmentId), {});
  return (
    <form action={act} className="flex items-center gap-1">
      <select name="stage" defaultValue={stage} className="rounded border border-line px-2 py-1 text-xs" aria-label="Stage for this event">
        {["considering", "contacted", "quoted", "committed", "declined"].map((o) => <option key={o} value={o}>Event: {o}</option>)}
      </select>
      <button className="rounded border border-line px-2 py-1 text-xs" disabled={pending}>Set</button>
      {s.error ? <span role="alert" className="text-xs text-red-700">{s.error}</span> : null}
      {s.ok ? <span className="text-xs text-emerald-700">{s.ok}</span> : null}
    </form>
  );
}

export function SupplierQuoteForm({ requestId, assignmentId }: { requestId: string; assignmentId: string }) {
  const [s, act, pending] = useActionState(addSupplierQuote.bind(null, requestId, assignmentId), {});
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-xs font-medium">Record a supplier quote (new version)</summary>
      <form action={act} className="mt-2 grid gap-2 sm:grid-cols-2">
        <input name="supplierQuote" className="field" placeholder="Supplier quote $" inputMode="decimal" />
        <input name="transport" className="field" placeholder="Transport $ (blank = unknown)" inputMode="decimal" />
        <input name="crew" className="field" placeholder="Setup/teardown & crew $ (blank = unknown)" inputMode="decimal" />
        <input name="other" className="field" placeholder="Other costs $ (blank = unknown)" inputMode="decimal" />
        <input name="scope" className="field sm:col-span-2" placeholder="What the supplier is offering" />
        <button className="btn-secondary py-2 sm:col-span-2" disabled={pending}>Save supplier quote</button>
        <div className="sm:col-span-2"><Result s={s} /></div>
      </form>
    </details>
  );
}

export function SendQuoteForm({ requestId, revising }: { requestId: string; revising: boolean }) {
  const [s, act, pending] = useActionState(sendQuote.bind(null, requestId), {});
  return (
    <form action={act} className="mt-4 space-y-2 rounded-lg bg-canvas p-3">
      <div className="text-sm font-medium">{revising ? "Send a revised quote (replaces the open one)" : "Send a quote to the customer"}</div>
      <input name="price" className="field" placeholder="Customer price $" inputMode="decimal" />
      <textarea name="scope" className="field min-h-20" placeholder="Scope the customer is accepting: ride, dates, hours, crew, transport, setup/teardown…" />
      <button className="btn-primary w-full py-2" disabled={pending}>Send quote</button>
      <Result s={s} />
    </form>
  );
}

export function WithdrawQuoteButton({ requestId }: { requestId: string }) {
  const [s, act, pending] = useActionState(withdrawQuote.bind(null, requestId), {});
  return (
    <form action={act} className="mt-2">
      <button className="text-xs text-red-700 underline" disabled={pending}>Withdraw open quote and return to sourcing</button>
      <Result s={s} />
    </form>
  );
}
