import { AccessError, createCheckout } from "@/lib/access/service";
import { accessRuntime, clientIp, rateLimited, redirect, requestOrigin } from "@/lib/access/runtime";
import { paths } from "@/lib/seo/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Step 2: pending purchase at the server-side price, then Stripe Checkout. */
export async function POST(req: Request) {
  if (rateLimited(`checkout:${clientIp(req) ?? "anon"}`, 10, 10 * 60e3)) return new Response("Too many requests", { status: 429 });
  const form = await req.formData();
  const eventRequestId = String(form.get("event") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(eventRequestId)) return new Response("Bad request", { status: 400 });
  try {
    const rt = await accessRuntime();
    const { url } = await createCheckout(rt.db, rt.gateway, eventRequestId, requestOrigin(req));
    return redirect(url);
  } catch (e) {
    if (e instanceof AccessError) return redirect(`${paths.connectMatches(eventRequestId)}?error=${e.code}`);
    console.error("[access] checkout failed:", (e as Error).message);
    return redirect(`${paths.connectMatches(eventRequestId)}?error=unavailable`);
  }
}
