import Link from "next/link";

export const metadata = { robots: { index: false, follow: false } };

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[70vh] bg-white">
      <div className="border-b border-line bg-ink-soft text-white">
        <div className="container-page flex h-11 items-center gap-4 text-sm">
          <span className="rounded bg-marquee px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-ink">Internal</span>
          <Link href="/internal" className="hover:underline">Request queue</Link>
          <span className="ml-auto text-xs text-white/60">Team only — never shown to customers</span>
        </div>
      </div>
      {children}
    </div>
  );
}
