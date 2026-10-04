import { getDb } from "@/lib/db";
import { handleGetPublic } from "@/lib/requests/handlers";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ reference: string }> }) {
  const { reference } = await ctx.params;
  const token = new URL(req.url).searchParams.get("t");
  const r = handleGetPublic(getDb(), reference, token);
  return Response.json(r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });
}
