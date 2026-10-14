import { AccessError, createCheckout } from "@/lib/access/service";
import { isBotRequest } from "@/lib/access/bot";
import { accessRuntime, clientIp, rateLimited, refuse, requestOrigin, respond } from "@/lib/access/runtime";
import { paths } from "@/lib/seo/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Step 2: pending purchase at the server-side price, then Stripe Checkout. */
export async function POST(req: Request) {
  if (await isBotRequest()) return refuse(req, 403, "Request blocked");
  if (rateLimited(`checkout:${clientIp(req) ?? "anon"}`, 10, 10 * 60e3)) return refuse(req, 429, "Too many requests");
  const form = await req.formData();
  const eventRequestId = String(form.get("event") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(eventRequestId)) return refuse(req, 400, "Bad request");
  try {
    const rt = await accessRuntime();
    const { url } = await createCheckout(rt.db, rt.gateway, eventRequestId, requestOrigin(req));
    return respond(req, url);
  } catch (e) {
    if (e instanceof AccessError) return respond(req, `${paths.connectMatches(eventRequestId)}?error=${e.code}`);
    console.error("[access] checkout failed:", (e as Error).message);
    return respond(req, `${paths.connectMatches(eventRequestId)}?error=unavailable`);
  }
}
