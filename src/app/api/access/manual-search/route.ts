import { AccessError, requestManualSearch } from "@/lib/access/service";
import { isBotRequest } from "@/lib/access/bot";
import { accessRuntime, clientIp, rateLimited, refuse, respond } from "@/lib/access/runtime";
import { paths } from "@/lib/seo/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Zero-match fallback, last step: the customer asks us to search by hand (free). Recorded once per request. */
export async function POST(req: Request) {
  if (await isBotRequest()) return refuse(req, 403, "Request blocked");
  if (rateLimited(`manual-search:${clientIp(req) ?? "anon"}`, 5, 10 * 60e3)) return refuse(req, 429, "Too many requests");
  const form = await req.formData();
  const eventRequestId = String(form.get("event") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(eventRequestId)) return refuse(req, 400, "Bad request");
  try {
    const rt = await accessRuntime();
    await requestManualSearch(rt.db, eventRequestId);
    return respond(req, `${paths.connectMatches(eventRequestId)}?manual=1`);
  } catch (e) {
    if (e instanceof AccessError) return respond(req, `${paths.connectMatches(eventRequestId)}?error=${e.code}`);
    console.error("[access] manual search failed:", (e as Error).message);
    return respond(req, `${paths.connectMatches(eventRequestId)}?error=unavailable`);
  }
}
