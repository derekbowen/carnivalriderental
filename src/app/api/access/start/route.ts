import { AccessError, startEventRequest } from "@/lib/access/service";
import { accessRuntime, clientIp, rateLimited, redirect } from "@/lib/access/runtime";
import { paths } from "@/lib/seo/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Step 1: save the event, count contactable operators, show the result before any payment. */
export async function POST(req: Request) {
  if (rateLimited(`start:${clientIp(req) ?? "anon"}`, 20, 10 * 60e3)) return new Response("Too many requests", { status: 429 });
  const form = await req.formData();
  const raw = Object.fromEntries([...form.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]));
  try {
    const rt = await accessRuntime();
    const { event } = await startEventRequest(rt.db, rt.source, raw);
    return redirect(paths.connectMatches(event.id));
  } catch (e) {
    if (e instanceof AccessError) {
      const back = new URLSearchParams();
      for (const k of ["listing", "type", "class", "state", "city"]) if (raw[k === "type" ? "rideType" : k === "class" ? "rideClass" : k === "listing" ? "listingId" : k]) back.set(k, raw[k === "type" ? "rideType" : k === "class" ? "rideClass" : k === "listing" ? "listingId" : k]);
      back.set("error", e.code);
      return redirect(`/connect?${back}`);
    }
    console.error("[access] start failed:", (e as Error).message);
    return redirect("/connect?error=unavailable");
  }
}
