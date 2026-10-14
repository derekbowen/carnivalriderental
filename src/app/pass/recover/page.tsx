import type { Metadata } from "next";
import { BRAND } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Find your pass | ${BRAND.name}`, robots: { index: false, follow: false } };

export default async function RecoverPage({ searchParams }: { searchParams: Promise<{ sent?: string; invalid?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl">Find your pass</h1>
      {sp.invalid && <p role="alert" className="mt-4 rounded-lg border border-pop/40 bg-pop/10 px-4 py-3 text-sm">That link is invalid or has expired. Request a new one below.</p>}
      {sp.sent ? (
        <p role="status" className="mt-4 rounded-lg border border-line bg-surface px-4 py-3 text-sm" data-testid="recover-sent">If that email has an active pass, a fresh link is on its way. Check spam if it doesn&rsquo;t arrive in a few minutes.</p>
      ) : (
        <p className="mt-3 text-ink-soft">Enter the email you used at checkout and we&rsquo;ll send a link that opens your pass on this device.</p>
      )}
      <form method="post" action="/api/pass/recover" className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input className="input flex-1" type="email" name="email" required placeholder="you@example.com" aria-label="Email" />
        <button className="btn-primary" type="submit">Email me the link</button>
      </form>
    </div>
  );
}
