import { accessDb } from "@/lib/access/db";
import { unsubscribe } from "@/lib/concierge/followup";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return new Response("Invalid link", { status: 400 });
  await unsubscribe(await accessDb(), token);
  return new Response("Your saved-search reminders have been stopped.", { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer" } });
}
