import { reportDeadContact } from "@/lib/access/service";
import { accessRuntime, parseCookie, passCookieName, passIdsFromCookie, redirect } from "@/lib/access/runtime";
import { paths } from "@/lib/seo/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** "This contact didn't work": flags the unlock for review; the audit record stays. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  if (!passIdsFromCookie(parseCookie(req.headers.get("cookie"), passCookieName)).includes(id)) return new Response("Forbidden", { status: 403 });
  const form = await req.formData();
  const operatorId = String(form.get("operator") ?? "");
  if (!/^[A-Za-z0-9_-]{3,80}$/.test(operatorId)) return new Response("Bad request", { status: 400 });
  const rt = await accessRuntime();
  await reportDeadContact(rt.db, id, operatorId);
  return redirect(`${paths.pass(id)}?reported=1#op-${operatorId}`);
}
