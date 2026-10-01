import type { Metadata } from "next";
import Link from "next/link";
import { integrationStatuses } from "@/lib/integrations/status";

export const metadata: Metadata = { title: "Internal — fulfilment", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#f3f1ec]">
      <div className="border-b border-danger/30 bg-danger-wash px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider text-danger">
        Internal — team only · contains supplier costs and margins · never share
      </div>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/internal" className="font-display text-2xl">Fulfilment console</Link>
          <ul className="flex flex-wrap gap-2 text-xs">
            {integrationStatuses().map((s) => (
              <li key={s.name} title={s.detail} className="rounded-full border border-line bg-paper px-3 py-1">
                {s.name}: <strong>{s.state === "development-adapter" ? "dev adapter (not connected)" : "not configured"}</strong>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
