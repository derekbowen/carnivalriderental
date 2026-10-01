import { getDb } from "@/lib/db";
import { handleAcceptQuote } from "@/lib/requests/handlers";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ reference: string }> }) {
  const { reference } = await ctx.params;
  const body = await req.json().catch(() => null);
  const r = handleAcceptQuote(getDb(), reference, body);
  return Response.json(r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });
}
