import { redeemMagicLink } from "@/lib/access/service";
import { accessRuntime, grantPassCookie, parseCookie, passCookieName, redirect } from "@/lib/access/runtime";
import { paths } from "@/lib/seo/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Magic link from the pass email: sets the pass cookie on this device and opens the pass. */
export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t") ?? "";
  if (!/^[A-Za-z0-9_-]{20,}$/.test(t)) return redirect(`${paths.passRecover()}?invalid=1`);
  try {
    const rt = await accessRuntime();
    const passId = await redeemMagicLink(rt.db, t);
    if (!passId) return redirect(`${paths.passRecover()}?invalid=1`);
    return redirect(paths.pass(passId), { "Set-Cookie": grantPassCookie(parseCookie(req.headers.get("cookie"), passCookieName), passId) });
  } catch (e) {
    console.error("[access] open failed:", (e as Error).message);
    return redirect(`${paths.passRecover()}?invalid=1`);
  }
}
