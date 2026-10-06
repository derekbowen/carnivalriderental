import { fakeGatewayInstance, stripeMode } from "@/lib/access/stripe";
import { redirect } from "@/lib/access/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Stand-in for Stripe's hosted Checkout page. Exists only with the fake gateway (APP_ENV=development). */
export async function GET(req: Request) {
  if (stripeMode().kind !== "fake") return new Response("Not found", { status: 404 });
  const fake = fakeGatewayInstance();
  const u = new URL(req.url);
  const cs = u.searchParams.get("cs") ?? "";
  const s = fake?.sessions.get(cs);
  if (!fake || !s) return new Response("Unknown test session", { status: 404 });
  const outcome = u.searchParams.get("outcome");
  if (outcome === "paid" || outcome === "expired") {
    fake.complete(cs, outcome);
    return redirect(outcome === "paid" ? s.successUrl.replace("{CHECKOUT_SESSION_ID}", cs) : s.cancelUrl);
  }
  if (outcome === "cancel") return redirect(s.cancelUrl);
  const html = `<!doctype html><html><head><meta name="robots" content="noindex"><title>Test checkout</title></head><body style="font-family:system-ui;max-width:480px;margin:40px auto;padding:0 16px">
    <h1>Test checkout (no real payment)</h1>
    <p>This stands in for Stripe Checkout in development. Amount: ${esc(String(((s.amountTotal ?? 0) / 100).toFixed(2)))} ${esc((s.currency ?? "usd").toUpperCase())}</p>
    <p><a id="pay" href="/api/access/dev-checkout?cs=${esc(cs)}&amp;outcome=paid" style="display:inline-block;background:#f5b400;padding:12px 18px;border-radius:8px;color:#0b1b3f;font-weight:700;text-decoration:none">Pay now (test)</a></p>
    <p><a id="cancel" href="/api/access/dev-checkout?cs=${esc(cs)}&amp;outcome=cancel">Cancel</a> · <a id="expire" href="/api/access/dev-checkout?cs=${esc(cs)}&amp;outcome=expired">Simulate expired session</a></p>
  </body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
