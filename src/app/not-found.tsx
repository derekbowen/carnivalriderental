import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/config";
import { paths } from "@/lib/seo/routes";

// Served with HTTP 404 by Next.js. Its own title and noindex replace the homepage defaults, so a
// missing URL never reads like the homepage to a crawler.
export const metadata: Metadata = { title: `Page not found | ${BRAND.name}`, robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="eyebrow">404</p>
      <h1 className="mt-2 text-4xl">Page not found</h1>
      <p className="mt-3 text-ink-soft">This page doesn&rsquo;t exist or has moved. Browse carnival rides by type, or start from the homepage.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={paths.rides()} className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-surface hover:opacity-90">
          Browse ride types
        </Link>
        <Link href={paths.home()} className="inline-flex min-h-11 items-center rounded-full border border-line-strong bg-surface px-5 text-sm hover:border-ink">
          Homepage
        </Link>
      </div>
    </div>
  );
}
