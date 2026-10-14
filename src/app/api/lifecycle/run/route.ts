import { accessDb } from "@/lib/access/db";
import { accessAvailability } from "@/lib/access/runtime";
import { runLifecycle } from "@/lib/lifecycle/engine";
import { lifecycleDeps } from "@/lib/lifecycle/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduled lifecycle pass: Vercel Cron calls it every 10 minutes (vercel.json; docs/EMAIL.md). It
 * only sends what the rules make due, once per logical email, and a run lock skips calls less than
 * 4 minutes apart, so an extra call can't send anything earlier or twice. LIFECYCLE_RUN_TOKEN or CRON_SECRET, when set, is required as
 * a bearer token (Vercel Cron sends CRON_SECRET automatically).
 */
async function handle(req: Request) {
  const token = process.env.LIFECYCLE_RUN_TOKEN || process.env.CRON_SECRET;
  if (token && req.headers.get("authorization") !== `Bearer ${token}`) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!accessAvailability().enabled) return Response.json({ ran: false, reason: "access unavailable" }, { status: 503 });
  try {
    const summary = await runLifecycle(await accessDb(), lifecycleDeps());
    return Response.json(summary, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[lifecycle] run failed:", (e as Error).message);
    return Response.json({ ran: false, reason: "error" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
