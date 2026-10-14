import { sendRecoveryLinks } from "@/lib/access/service";
import { isBotRequest } from "@/lib/access/bot";
import { accessRuntime, clientIp, rateLimited, refuse, respond } from "@/lib/access/runtime";
import { paths } from "@/lib/seo/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lost link: always answers the same way, so it can't be used to probe which emails bought a pass. */
export async function POST(req: Request) {
  if (await isBotRequest()) return refuse(req, 403, "Request blocked");
  if (rateLimited(`recover:${clientIp(req) ?? "anon"}`, 5, 10 * 60e3)) return refuse(req, 429, "Too many requests");
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
  return respond(req, `${paths.passRecover()}?sent=1`);
}
