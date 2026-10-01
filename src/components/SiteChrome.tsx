import Link from "next/link";
import { appEnv, BRAND, publicIndexingEnabled } from "@/lib/config";
import { paths } from "@/lib/seo/routes";

export function EnvBanner() {
  if (appEnv() === "production" && publicIndexingEnabled()) return null;
  return (
    <div className="bg-ink px-4 py-1.5 text-center text-xs text-white/90">
      <strong className="font-semibold">{appEnv().toUpperCase()} build</strong> · not public, not indexed · demo data · payments in demo mode (no cards, no charges)
    </div>
  );
}

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-canvas/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="whitespace-nowrap font-display text-lg font-semibold tracking-tight sm:text-xl">
          {BRAND.name}
          {BRAND.isPlaceholder && <span className="ml-2 hidden align-middle text-[10px] font-sans font-semibold uppercase tracking-wider text-muted sm:inline">working name</span>}
        </Link>
        <nav className="flex items-center gap-1 text-sm sm:gap-4">
          <Link href={paths.rides()} className="whitespace-nowrap rounded-full px-2 py-2 hover:bg-paper sm:px-3">Browse rides</Link>
          <Link href="/#how-it-works" className="hidden rounded-full px-3 py-2 hover:bg-paper sm:inline">How it works</Link>
          <Link href={paths.request()} className="btn-primary whitespace-nowrap !px-4 !py-2">Start a request</Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 text-sm text-ink-soft sm:grid-cols-3 sm:px-6">
        <div>
          <div className="font-display text-lg text-ink">{BRAND.name}</div>
          <p className="mt-2 max-w-xs">Managed carnival ride rentals. We source the ride and operating crew for your event and manage the booking end to end.</p>
        </div>
        <div>
          <div className="font-semibold text-ink">Rides</div>
          <ul className="mt-2 space-y-1">
            <li><Link href={paths.rides()} className="hover:underline">All ride rentals</Link></li>
            <li><Link href={paths.request()} className="hover:underline">Start an event request</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold text-ink">How we work</div>
          <p className="mt-2">Availability is confirmed per event. Nothing is booked until you accept a final scope and price and the booking is confirmed.</p>
        </div>
      </div>
    </footer>
  );
}
