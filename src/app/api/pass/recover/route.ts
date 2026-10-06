import { sendRecoveryLinks } from "@/lib/access/service";
import { accessRuntime, clientIp, rateLimited, redirect } from "@/lib/access/runtime";
import { paths } from "@/lib/seo/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lost link: always answers the same way, so it can't be used to probe which emails bought a pass. */
export async function POST(req: Request) {
  if (rateLimited(`recover:${clientIp(req) ?? "anon"}`, 5, 10 * 60e3)) return new Response("Too many requests", { status: 429 });
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !rateLimited(`recover-email:${email}`, 3, 60 * 60e3)) {
    try {
      const rt = await accessRuntime();
      await sendRecoveryLinks(rt.db, email, rt.siteUrl);
    } catch (e) {
      console.error("[access] recovery failed:", (e as Error).message);
    }
  }
  return redirect(`${paths.passRecover()}?sent=1`);
}
