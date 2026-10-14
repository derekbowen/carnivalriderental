import { AccessError, unlockOperator } from "@/lib/access/service";
import { accessRuntime, clientIp, parseCookie, passCookieName, passIdsFromCookie, rateLimited, redirect } from "@/lib/access/runtime";
import { ipHash, sessionSecret } from "@/lib/access/session";
import { paths } from "@/lib/seo/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reveal one operator for a pass the browser is entitled to. Contact data never leaves the server otherwise. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  if (!passIdsFromCookie(parseCookie(req.headers.get("cookie"), passCookieName)).includes(id)) return new Response("Forbidden", { status: 403 });
  if (rateLimited(`unlock:${id}`, 30, 60e3)) return new Response("Too many requests", { status: 429 });
  const form = await req.formData();
  const operatorId = String(form.get("operator") ?? "");
  if (!/^[A-Za-z0-9_-]{3,80}$/.test(operatorId)) return new Response("Bad request", { status: 400 });
  try {
    const rt = await accessRuntime();
    await unlockOperator(rt.db, rt.source, id, operatorId, { ipHash: ipHash(clientIp(req), sessionSecret()), userAgent: req.headers.get("user-agent") });
    return redirect(`${paths.pass(id)}#op-${operatorId}`);
  } catch (e) {
    if (e instanceof AccessError) return redirect(`${paths.pass(id)}?error=${e.code}#op-${operatorId}`);
    console.error("[access] unlock failed:", (e as Error).message);
    return redirect(`${paths.pass(id)}?error=unavailable`);
  }
}
