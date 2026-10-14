import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/config";
import { paths } from "@/lib/seo/routes";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Confirming your payment | ${BRAND.name}`, robots: { index: false, follow: false } };

/** Shown while Stripe's confirmation is on its way; re-checks the server-verified state every few seconds. */
export default async function PendingPage({ searchParams }: { searchParams: Promise<{ p?: string; cs?: string; n?: string; err?: string }> }) {
  const sp = await searchParams;
  const n = Number(sp.n ?? 0) || 0;
  const ok = /^[0-9a-f-]{36}$/.test(sp.p ?? "") && /^cs_[A-Za-z0-9_]+$/.test(sp.cs ?? "");
  const again = ok && n < 20 ? `/api/access/return?p=${sp.p}&cs=${sp.cs}&n=${n}` : null;
  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      {again && <meta httpEquiv="refresh" content={`3;url=${again}`} />}
      <h1 className="text-3xl">{again ? "Confirming your payment…" : "We're still waiting for Stripe"}</h1>
      <p className="mt-3 text-ink-soft">
        {again
          ? "This usually takes a few seconds. Your pass opens automatically once Stripe confirms the payment."
          : "Your payment may still be processing. The pass link arrives by email as soon as it's confirmed; you can also request it below."}
      </p>
      {again ? (
        <p className="mt-6 text-sm text-muted">Not moving? <a className="underline" href={again}>Check again now</a>.</p>
      ) : (
        <Link href={paths.passRecover()} className="btn-primary mt-6">Email me my pass link</Link>
      )}
    </div>
  );
}
