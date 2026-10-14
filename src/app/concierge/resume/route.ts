import { accessDb } from "@/lib/access/db";
import { newToken, hashToken } from "@/lib/access/session";
import { SESSION_COOKIE } from "@/lib/concierge/service";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return new Response("Invalid link", { status: 400 });
  const db = await accessDb();
  const c = (await db.query(`SELECT session_id FROM concierge_followup_consent WHERE resume_token = ? AND consented_at > ?`, [token, new Date(Date.now() - 30 * 864e5).toISOString()]))[0];
  if (!c) return new Response("Invalid link", { status: 404 });
  // Restores event details only; never grants a pass or operator contacts.
  const fresh = newToken();
  await db.query(`UPDATE concierge_sessions SET token_hash = ?, expires_at = ? WHERE id = ?`, [hashToken(fresh), new Date(Date.now() + 30 * 864e5).toISOString(), c.session_id]);
  return new Response(null, { status: 303, headers: { Location: "/concierge", "Set-Cookie": `${SESSION_COOKIE}=${fresh}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${process.env.APP_ENV !== "development" ? "; Secure" : ""}`, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
