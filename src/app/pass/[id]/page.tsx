import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { OperatorMatch } from "@/components/access/OperatorMatch";
import { accessDb } from "@/lib/access/db";
import { accessAvailability, passCookieName, passIdsFromCookie } from "@/lib/access/runtime";
import { passView } from "@/lib/access/service";
import { BRAND } from "@/lib/config";
import { rideTypeFor } from "@/lib/inventory";
import { rideTypeCopy } from "@/lib/inventory/ride-type-copy";
import { paths } from "@/lib/seo/routes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: `Your pass | ${BRAND.name}`, robots: { index: false, follow: false } };

const ERRORS: Record<string, string> = {
  limit: "You've used every unlock on this pass.",
  expired: "This pass has expired, so no new operators can be unlocked.",
  revoked: "This pass was revoked, so no new operators can be unlocked.",
  forbidden: "That operator isn't part of this pass.",
  not_found: "That operator has no usable contact details right now. No unlock was used.",
  unavailable: "Something went wrong on our side. No unlock was used.",
};

/**
 * The customer's pass. Rendered only for a browser whose signed cookie names this pass; contact
 * details come from the unlock snapshots the server wrote after each entitlement check.
 */
export default async function PassPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; reported?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id) || !accessAvailability().enabled) notFound();
  const allowed = passIdsFromCookie((await cookies()).get(passCookieName)?.value).includes(id);
  if (!allowed) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6" data-testid="pass-locked">
        <h1 className="text-3xl">Open your pass from your email</h1>
        <p className="mt-3 text-ink-soft">For your privacy, a pass opens only from the link we emailed you. Lost it? Enter your email and we&rsquo;ll send a fresh link.</p>
        <form method="post" action="/api/pass/recover" className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input className="input flex-1" type="email" name="email" required placeholder="you@example.com" aria-label="Email" />
          <button className="btn-primary" type="submit">Email me the link</button>
        </form>
      </div>
    );
  }
  const view = await passView(await accessDb(), id);
  if (!view) notFound();
  const { pass, event, product, unlocks, remaining, usable, blockedReason } = view;
  const byOp = new Map(unlocks.map((u) => [u.operatorId, u]));
  const typeLabel = event.rideType ? rideTypeCopy(event.rideType, rideTypeFor(event.rideType)?.name ?? event.rideType).label : event.rideClass ? `${event.rideClass} rides` : "carnival rides";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="eyebrow">{product.name}</p>
      <h1 className="mt-2 text-4xl">Your operator contacts for {event.city}, {event.state}</h1>
      <p className="mt-2 text-ink-soft">{typeLabel} · {event.eventDate} · pass valid until {pass.expiresAt.slice(0, 10)}</p>
      <div className="mt-5 flex flex-wrap gap-3 text-sm" data-testid="pass-status">
        <span className="rounded-full bg-surface px-3 py-1.5 font-semibold ring-1 ring-line">{pass.unlockedCount} of {pass.unlockLimit} unlocked</span>
        <span className="rounded-full bg-surface px-3 py-1.5 ring-1 ring-line">{remaining} remaining</span>
        <span className={`rounded-full px-3 py-1.5 ring-1 ring-line ${usable ? "bg-ok-wash text-ok" : "bg-canvas text-muted"}`}>{usable ? "Active" : pass.status === "revoked" ? "Revoked" : "Expired"}</span>
      </div>
      {blockedReason && <p role="status" className="mt-4 rounded-lg border border-line bg-surface px-4 py-3 text-sm">{blockedReason}</p>}
      {sp.error && <p role="alert" className="mt-4 rounded-lg border border-pop/40 bg-pop/10 px-4 py-3 text-sm" data-testid="pass-error">{ERRORS[sp.error] ?? ERRORS.unavailable}</p>}
      {sp.reported && <p role="status" className="mt-4 rounded-lg border border-line bg-surface px-4 py-3 text-sm">Thanks. We&rsquo;ll check that contact.</p>}

      <ul className="mt-8 space-y-4" data-testid="pass-operators">
        {event.operators.map((op) => <OperatorMatch key={op.operatorId} op={op} unlock={byOp.get(op.operatorId) ?? null} passId={pass.id} usable={usable} remaining={remaining} reported={!!sp.reported} />)}
      </ul>

      <div className="mt-10 card p-5 text-sm text-ink-soft">
        <p><strong>How to use this.</strong> Call or email each operator with your date, location, hours and site details. Ask what&rsquo;s included (delivery, setup, crew, power, insurance) and get the agreement in writing with them. {BRAND.name} isn&rsquo;t part of the rental and can&rsquo;t guarantee availability or a reply. If a contact doesn&rsquo;t work, use &ldquo;This contact didn&rsquo;t work&rdquo; and we&rsquo;ll check it.</p>
        <p className="mt-2 text-xs text-muted">Keep the link from your email to reopen this page on any device. <Link className="underline" href={paths.accessPolicy()}>Access and refund policy</Link>.</p>
      </div>
    </div>
  );
}
