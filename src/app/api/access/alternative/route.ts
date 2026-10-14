import { AccessError, createAlternativeRequest } from "@/lib/access/service";
import { isBotRequest } from "@/lib/access/bot";
import { accessRuntime, clientIp, rateLimited, refuse, respond } from "@/lib/access/runtime";
import { paths } from "@/lib/seo/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Zero-match fallback: the customer picks one of the alternatives shown for their request (fallback.ts). */
export async function POST(req: Request) {
  if (await isBotRequest()) return refuse(req, 403, "Request blocked");
  if (rateLimited(`alternative:${clientIp(req) ?? "anon"}`, 20, 10 * 60e3)) return refuse(req, 429, "Too many requests");
  const form = await req.formData();
  const eventRequestId = String(form.get("event") ?? "");
  const offer = Number(form.get("offer"));
  if (!/^[0-9a-f-]{36}$/.test(eventRequestId) || !Number.isInteger(offer) || offer < 0 || offer > 20) return refuse(req, 400, "Bad request");
  try {
    const rt = await accessRuntime();
    const { event } = await createAlternativeRequest(rt.db, rt.source, eventRequestId, offer);
    return respond(req, paths.connectMatches(event.id));
  } catch (e) {
    if (e instanceof AccessError) return respond(req, `${paths.connectMatches(eventRequestId)}?error=${e.code === "not_sellable" ? "alternative_gone" : e.code}`);
    console.error("[access] alternative failed:", (e as Error).message);
    return respond(req, `${paths.connectMatches(eventRequestId)}?error=unavailable`);
  }
}
