import { NextResponse } from "next/server";
import { getRequestService } from "@/lib/requests";
import { errorResult, handleCreateRequest } from "@/lib/requests/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  let result;
  try {
    result = handleCreateRequest(body, getRequestService());
  } catch (e) {
    // e.g. the store could not be opened. Never report success.
    result = errorResult(e);
  }
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}
