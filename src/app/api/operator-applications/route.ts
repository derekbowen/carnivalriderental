import { NextResponse } from "next/server";
import { getDb } from "@/lib/requests/db";
import { OperatorApplications, submitOperatorApplication } from "@/lib/operators/applications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  try {
    const r = submitOperatorApplication(body, new OperatorApplications(getDb()));
    return NextResponse.json(r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    // e.g. the store could not be opened. Never report success.
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
}
