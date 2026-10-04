"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { checkInternalAuth } from "@/lib/internal-auth";
import {
  addSupplierToRequest,
  createSupplier,
  recordSupplierQuote,
  RuleError,
  sendCustomerQuote,
  setAssignmentStage,
  setNextAction,
  setSupplierStatus,
  transition,
  withdrawCustomerQuote,
  type AssignmentRow,
  type SupplierRow,
} from "@/lib/requests/repo";
import { FULFILLMENT, type FulfillmentStatus } from "@/lib/requests/status";

export type ActionState = { error?: string; ok?: string };

async function actor(): Promise<string> {
  const auth = checkInternalAuth((await headers()).get("authorization"));
  if (!auth.ok) throw new RuleError("Not signed in to the internal area.", "unauthorized", 401);
  return `team:${auth.user}`;
}

const dollarsToCents = (v: FormDataEntryValue | null): number | null => {
  const s = String(v ?? "").replace(/[$,\s]/g, "");
  if (!s) return null;
  const n = Math.round(Number(s) * 100);
  if (!Number.isFinite(n) || n < 0) throw new RuleError("Amounts must be numbers of dollars.", "bad_amount", 400);
  return n;
};

async function run(requestId: string, fn: (who: string) => void, ok: string): Promise<ActionState> {
  try {
    fn(await actor());
  } catch (e) {
    if (e instanceof RuleError) return { error: e.message };
    console.error("[internal action] failed", e instanceof Error ? e.message : e);
    return { error: "That change was not saved." };
  }
  revalidatePath(`/internal/requests/${requestId}`);
  revalidatePath("/internal");
  return { ok };
}

export async function changeStatus(requestId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  const to = String(fd.get("to") ?? "") as FulfillmentStatus;
  if (!FULFILLMENT.includes(to)) return { error: "Choose a status." };
  return run(requestId, (who) => transition(getDb(), requestId, to, who, String(fd.get("note") ?? "") || undefined), "Status updated.");
}

export async function updateNextAction(requestId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return run(requestId, (who) => setNextAction(getDb(), requestId, String(fd.get("nextAction") ?? ""), who), "Next action saved.");
}

export async function addSupplier(requestId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return run(requestId, (who) => {
    const db = getDb();
    let supplierId = String(fd.get("supplierId") ?? "");
    const newName = String(fd.get("newName") ?? "").trim();
    if (!supplierId && newName) {
      supplierId = createSupplier(db, { name: newName, region: String(fd.get("region") ?? "") || null, contact: String(fd.get("contact") ?? "") || null }).id;
    }
    if (!supplierId) throw new RuleError("Choose a supplier or enter a new one.", "no_supplier", 400);
    addSupplierToRequest(db, requestId, supplierId, who);
  }, "Supplier added.");
}

export async function changeSupplierStatus(requestId: string, supplierId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return run(requestId, () => setSupplierStatus(getDb(), supplierId, String(fd.get("status")) as SupplierRow["status"]), "Supplier status updated.");
}

export async function changeStage(requestId: string, assignmentId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return run(requestId, (who) => setAssignmentStage(getDb(), assignmentId, String(fd.get("stage")) as AssignmentRow["stage"], who), "Stage updated.");
}

export async function addSupplierQuote(requestId: string, assignmentId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return run(
    requestId,
    (who) =>
      recordSupplierQuote(
        getDb(),
        assignmentId,
        {
          supplierQuoteCents: dollarsToCents(fd.get("supplierQuote")),
          transportCents: dollarsToCents(fd.get("transport")),
          crewCents: dollarsToCents(fd.get("crew")),
          otherCents: dollarsToCents(fd.get("other")),
          scope: String(fd.get("scope") ?? ""),
        },
        who,
      ),
    "Supplier quote recorded.",
  );
}

export async function sendQuote(requestId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return run(requestId, (who) => sendCustomerQuote(getDb(), requestId, { priceCents: dollarsToCents(fd.get("price")), scope: fd.get("scope") }, who), "Quote sent to the customer.");
}

export async function withdrawQuote(requestId: string): Promise<ActionState> {
  return run(requestId, (who) => withdrawCustomerQuote(getDb(), requestId, who), "Quote withdrawn.");
}
