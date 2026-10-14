import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestService } from "@/lib/requests";
import { verifyCustomerToken } from "@/lib/requests/access";
import { errorResult } from "@/lib/requests/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ token: z.string().min(1), quoteId: z.string().uuid() });

export async function POST(req: Request, ctx: { params: Promise<{ reference: string }> }) {
  const { reference } = await ctx.params;
  try {
    const { token, quoteId } = bodySchema.parse(await req.json());
    const svc = getRequestService();
    const request = svc.getByReference(reference);
    // Same response for unknown reference and bad token: do not reveal which requests exist.
    if (!request || !verifyCustomerToken(request.id, token)) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    const updated = svc.acceptQuote(request.id, quoteId);
    return NextResponse.json({ ok: true, fulfilmentStatus: updated.fulfilmentStatus }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const r = errorResult(e);
    return NextResponse.json(r.body, { status: r.status });
  }
}
