import { NextResponse } from "next/server";
import { checkInternalAuth } from "@/lib/auth";
import { getRequestService } from "@/lib/requests";
import { errorResult } from "@/lib/requests/http";
import { internalActionSchema, runInternalAction } from "@/lib/requests/internal-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // Defence in depth: middleware already enforces this.
  if (checkInternalAuth(req.headers.get("authorization")) !== "ok") {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    const action = internalActionSchema.parse(await req.json());
    runInternalAction(getRequestService(), id, action);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const r = errorResult(e);
    return NextResponse.json(r.body, { status: r.status });
  }
}
