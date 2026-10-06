import { handleStripeEvent } from "@/lib/access/service";
import { accessRuntime } from "@/lib/access/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stripe webhook: signature verified (real mode), idempotent on event id, 200 once recorded. */
export async function POST(req: Request) {
  const raw = await req.text();
  let rt;
  try {
    rt = await accessRuntime();
  } catch (e) {
    return new Response((e as Error).message, { status: 503 });
  }
  let event;
  try {
    event = rt.gateway.parseWebhook(raw, req.headers.get("stripe-signature"));
  } catch (e) {
    return new Response(`Webhook rejected: ${(e as Error).message}`, { status: 400 });
  }
  try {
    const result = await handleStripeEvent(rt.db, event, rt.siteUrl);
    return Response.json({ received: true, result });
  } catch (e) {
    console.error("[access] webhook processing failed:", event.type, (e as Error).message);
    return new Response("Processing failed", { status: 500 });
  }
}
