import { activateFromSession } from "@/lib/access/service";
import { accessRuntime, grantPassCookie, parseCookie, passCookieName, redirect } from "@/lib/access/runtime";
import { paths } from "@/lib/seo/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe's success_url. Nothing here trusts the redirect: the session is retrieved from Stripe and
 * only a `paid` status activates the pass (idempotently; the webhook may already have done it).
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const purchaseId = u.searchParams.get("p") ?? "";
  const sessionId = u.searchParams.get("cs") ?? "";
  const n = Math.min(Number(u.searchParams.get("n") ?? 0) || 0, 30);
  if (!/^[0-9a-f-]{36}$/.test(purchaseId) || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return new Response("Bad request", { status: 400 });
  try {
    const rt = await accessRuntime();
    const r = await activateFromSession(rt.db, rt.gateway, purchaseId, sessionId, rt.siteUrl);
    if (r.state === "paid") return redirect(paths.pass(r.pass.id), { "Set-Cookie": grantPassCookie(parseCookie(req.headers.get("cookie"), passCookieName), r.pass.id) });
    if (r.state === "mismatch") return new Response("Session does not match purchase", { status: 400 });
    if (r.state === "expired") return redirect(`/connect?error=expired`);
    return redirect(`/pass/pending?p=${purchaseId}&cs=${sessionId}&n=${n + 1}`);
  } catch (e) {
    console.error("[access] return failed:", (e as Error).message);
    return redirect(`/pass/pending?p=${purchaseId}&cs=${sessionId}&n=${n + 1}&err=1`);
  }
}
