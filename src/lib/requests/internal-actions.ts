import { z } from "zod";
import { DomainError, type RequestService } from "./service";

const cents = z.number().int().nonnegative().nullable();

/** Every team action, validated server-side. The UI is a convenience, not the guard. */
export const internalActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("transition"), to: z.enum(["in_review", "sourcing", "unable_to_source", "declined"]), note: z.string().max(500).nullable().default(null) }),
  z.object({ action: z.literal("add_candidate"), supplierId: z.string().uuid(), unitId: z.string().uuid().nullable().default(null), notes: z.string().max(1000).nullable().default(null) }),
  z.object({ action: z.literal("set_candidate_stage"), candidateId: z.string().uuid(), stage: z.enum(["candidate", "contacted", "declined"]) }),
  z.object({
    action: z.literal("record_supplier_quote"),
    supplierId: z.string().uuid(),
    supplierPriceCents: cents,
    transportCents: cents,
    crewCents: cents,
    otherCents: cents,
    notes: z.string().max(2000).nullable().default(null),
  }),
  z.object({ action: z.literal("create_quote"), amountCents: z.number().int().positive(), scope: z.string().min(1).max(4000) }),
  z.object({ action: z.literal("send_quote"), quoteId: z.string().uuid() }),
  z.object({ action: z.literal("commit_supplier"), candidateId: z.string().uuid(), note: z.string().max(500).nullable().default(null) }),
  z.object({
    action: z.literal("demo_payment"),
    to: z.enum(["none", "payment_method_saved", "funds_authorized", "payment_captured", "refunded", "failed"]),
    note: z.string().max(500).nullable().default(null),
  }),
  z.object({ action: z.literal("confirm_booking") }),
]);

export type InternalAction = z.infer<typeof internalActionSchema>;

export function runInternalAction(svc: RequestService, requestId: string, a: InternalAction): void {
  switch (a.action) {
    case "transition":
      svc.teamTransition(requestId, a.to, a.note);
      return;
    case "add_candidate":
      svc.addCandidate(requestId, a.supplierId, a.unitId, a.notes);
      return;
    case "set_candidate_stage":
      svc.setCandidateStage(a.candidateId, a.stage);
      return;
    case "record_supplier_quote":
      svc.recordSupplierQuote({ requestId, ...a });
      return;
    case "create_quote":
      svc.createQuoteDraft(requestId, a.amountCents, a.scope);
      return;
    case "send_quote": {
      const q = svc.getQuote(a.quoteId);
      if (!q || q.requestId !== requestId) throw new DomainError("Quote does not belong to this request", "not_found");
      svc.sendQuote(a.quoteId);
      return;
    }
    case "commit_supplier":
      svc.commitSupplier(requestId, a.candidateId, a.note);
      return;
    case "demo_payment":
      svc.recordDemoPayment(requestId, a.to, a.note);
      return;
    case "confirm_booking":
      svc.confirmBooking(requestId);
      return;
  }
}
