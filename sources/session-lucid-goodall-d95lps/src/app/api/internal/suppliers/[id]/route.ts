import { getDb } from "@/lib/db";
import { internalRoute, jsonBody } from "@/lib/internal-api";
import { setSupplierStatus, type SupplierRow } from "@/lib/requests/repo";

export const dynamic = "force-dynamic";

export const PATCH = internalRoute(async (req, _actor, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const b = await jsonBody(req);
  setSupplierStatus(getDb(), id, b.status as SupplierRow["status"]);
  return Response.json({ ok: true });
});
