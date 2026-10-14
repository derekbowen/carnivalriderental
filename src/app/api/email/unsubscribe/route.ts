import { getDb } from "@/lib/requests/db";
import { emailConfig } from "@/lib/email/config";
import { suppress, verifyUnsubscribe } from "@/lib/email/outbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Unsubscribe from outreach email. GET = the link in the email (shows a confirmation page);
 * POST = RFC 8058 one-click from the mail client's List-Unsubscribe header. Both suppress the
 * address immediately. The token is an HMAC of the address, so links can't be forged or enumerated.
 */
function handle(url: URL): { ok: boolean } {
  const email = url.searchParams.get("e") ?? "";
  const token = url.searchParams.get("t") ?? "";
  const secret = emailConfig().unsubscribeSecret;
  if (!secret || !email || !verifyUnsubscribe(email, token, secret)) return { ok: false };
  suppress(getDb(), email, "unsubscribe_link");
  return { ok: true };
}

const page = (ok: boolean) =>
  new Response(
    `<!doctype html><html><head><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe</title></head><body style="font-family:system-ui,sans-serif;max-width:480px;margin:64px auto;padding:0 16px"><h1>${
      ok ? "You're unsubscribed" : "This link isn't valid"
    }</h1><p>${ok ? "We won't send you any more emails like this." : "Reply to the email you received and we'll remove you by hand."}</p></body></html>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
  );

export async function GET(req: Request) {
  return page(handle(new URL(req.url)).ok);
}

export async function POST(req: Request) {
  const { ok } = handle(new URL(req.url));
  return new Response(null, { status: ok ? 200 : 400, headers: { "Cache-Control": "no-store" } });
}
