import type { Metadata } from "next";
import Link from "next/link";
import { integrationStatuses } from "@/lib/integrations/status";

export const metadata: Metadata = { title: "Internal — fulfilment", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#f3f1ec]">
      <div className="border-b border-danger/30 bg-danger-wash px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider text-danger">
        Internal — team only · contains supplier costs and margins · never share
      </div>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-baseline gap-4">
            <Link href="/internal" className="font-display text-2xl">Fulfilment console</Link>
            <nav aria-label="Console" className="flex flex-wrap gap-3 text-sm">
              <Link href="/internal" className="underline">Requests</Link>
              <Link href="/internal/operators" className="underline">Operator applications</Link>
              <Link href="/internal/leads" className="underline">Leads</Link>
              <Link href="/internal/funnel" className="underline">Funnel</Link>
            </nav>
          </div>
          <ul className="flex flex-wrap gap-2 text-xs">
            {(await integrationStatuses()).map((s) => (
              <li key={s.name} title={s.detail} data-testid="integration-status" className={`rounded-2xl border px-3 py-1 ${s.tone === "ok" ? "border-ok/30 bg-ok-wash text-ok" : s.tone === "bad" ? "border-danger/30 bg-danger-wash text-danger" : "border-line bg-paper"}`}>
                {/* Tap to read the detail on a phone, where there is no hover title. */}
                <details>
                  <summary className="cursor-pointer list-none">{s.name}: <strong>{s.label}</strong></summary>
                  <p className="max-w-xs pb-1 pt-1 text-ink-soft">{s.detail}</p>
                </details>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
