import { getDb } from "@/lib/db";
import { internalRoute, jsonBody } from "@/lib/internal-api";
import {
  addSupplierToRequest,
  assignments,
  customerQuotes,
  getRequest,
  requestHistory,
  RuleError,
  sendCustomerQuote,
  setNextAction,
  transition,
  withdrawCustomerQuote,
} from "@/lib/requests/repo";
import { FULFILLMENT, type FulfillmentStatus } from "@/lib/requests/status";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const GET = internalRoute(async (_req, _actor, ctx: Ctx) => {
  const { id } = await ctx.params;
  const db = getDb();
  const request = getRequest(db, id);
  if (!request) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({
    request,
    assignments: assignments(db, id),
    customerQuotes: customerQuotes(db, id),
    history: requestHistory(db, id),
  });
});

export const POST = internalRoute(async (req, actor, ctx: Ctx) => {
  const { id } = await ctx.params;
  const b = await jsonBody(req);
  const db = getDb();
  switch (b.action) {
    case "transition": {
      if (!FULFILLMENT.includes(b.to as FulfillmentStatus)) throw new RuleError("Unknown status.", "bad_status", 400);
      transition(db, id, b.to as FulfillmentStatus, actor, typeof b.note === "string" ? b.note : undefined);
      break;
    }
    case "next_action":
      setNextAction(db, id, String(b.nextAction ?? ""), actor);
      break;
    case "add_supplier":
      addSupplierToRequest(db, id, String(b.supplierId ?? ""), actor);
      break;
    case "send_quote":
      sendCustomerQuote(db, id, { priceCents: b.priceCents, scope: b.scope }, actor);
      break;
    case "withdraw_quote":
      withdrawCustomerQuote(db, id, actor);
      break;
    default:
      throw new RuleError("Unknown action.", "bad_action", 400);
  }
  return Response.json({ ok: true, request: getRequest(db, id) });
});
