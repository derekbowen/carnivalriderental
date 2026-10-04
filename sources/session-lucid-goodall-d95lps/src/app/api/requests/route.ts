import { getDb } from "@/lib/db";
import { handleCreateRequest } from "@/lib/requests/handlers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }
  let db;
  try {
    db = getDb();
  } catch (e) {
    console.error("[requests] database unavailable", e instanceof Error ? e.message : e);
    return Response.json({ error: "not_saved", message: "Your request was not saved. Please try again." }, { status: 503 });
  }
  const r = handleCreateRequest(db, body);
  return Response.json(r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });
}
