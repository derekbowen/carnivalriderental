import { isBotRequest } from "@/lib/access/bot";
import { accessRuntime, clientIp, rateLimited, refuse, respond } from "@/lib/access/runtime";
import { sendSavedSearch } from "@/lib/lifecycle/engine";
import { lifecycleDeps } from "@/lib/lifecycle/runtime";
import { paths } from "@/lib/seo/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** "Email me these results": the customer asks for it, so it is sent now, once per request, to the address on the request. */
export async function POST(req: Request) {
  if (await isBotRequest()) return refuse(req, 403, "Request blocked");
  if (rateLimited(`save-search:${clientIp(req) ?? "anon"}`, 5, 10 * 60e3)) return refuse(req, 429, "Too many requests");
  const form = await req.formData();
  const eventRequestId = String(form.get("event") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(eventRequestId)) return refuse(req, 400, "Bad request");
  try {
    const rt = await accessRuntime();
    const r = await sendSavedSearch(rt.db, eventRequestId, lifecycleDeps());
    return respond(req, `${paths.connectMatches(eventRequestId)}?saved=${r.outcome === "sent" || r.outcome === "skipped" ? "1" : "0"}`);
  } catch (e) {
    console.error("[lifecycle] saved search failed:", (e as Error).message);
    return respond(req, `${paths.connectMatches(eventRequestId)}?saved=0`);
  }
}
