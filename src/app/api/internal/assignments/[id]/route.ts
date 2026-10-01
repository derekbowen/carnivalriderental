import { getDb } from "@/lib/db";
import { internalRoute, jsonBody } from "@/lib/internal-api";
import { recordSupplierQuote, RuleError, setAssignmentStage, type AssignmentRow } from "@/lib/requests/repo";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const STAGES: AssignmentRow["stage"][] = ["considering", "contacted", "quoted", "committed", "declined"];

/** Change the supplier's stage for this event. */
export const PATCH = internalRoute(async (req, actor, ctx: Ctx) => {
  const { id } = await ctx.params;
  const b = await jsonBody(req);
  if (!STAGES.includes(b.stage as AssignmentRow["stage"])) throw new RuleError("Unknown stage.", "bad_stage", 400);
  setAssignmentStage(getDb(), id, b.stage as AssignmentRow["stage"], actor);
  return Response.json({ ok: true });
});

/** Record a new version of the supplier's quote and cost breakdown. */
export const POST = internalRoute(async (req, actor, ctx: Ctx) => {
  const { id } = await ctx.params;
  const b = await jsonBody(req);
  recordSupplierQuote(getDb(), id, b, actor);
  return Response.json({ ok: true }, { status: 201 });
});
