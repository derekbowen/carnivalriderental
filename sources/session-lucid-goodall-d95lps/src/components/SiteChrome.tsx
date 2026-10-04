import Link from "next/link";
import { BRAND } from "@/lib/site";
import { paths } from "@/lib/urls";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-canvas/95 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href={paths.home()} className="whitespace-nowrap font-display text-xl tracking-tight text-ink">
          {BRAND.name}
          <span className="ml-2 align-middle text-[10px] font-sans font-semibold uppercase tracking-widest text-marquee-deep">
            dev
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm sm:gap-4">
          <Link href={paths.rides()} className="whitespace-nowrap rounded-md px-2 py-1.5 text-ink-muted hover:text-ink">
            <span className="sm:hidden">Rides</span>
            <span className="hidden sm:inline">Browse rides</span>
          </Link>
          <Link href="/#how-it-works" className="hidden rounded-md px-2 py-1.5 text-ink-muted hover:text-ink sm:inline">
            How it works
          </Link>
          <Link href={paths.request()} className="btn-primary whitespace-nowrap px-3 py-2 sm:px-4">
            <span className="sm:hidden">Request</span>
            <span className="hidden sm:inline">Start an event request</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-ink text-white/80">
      <div className="container-page grid gap-8 py-12 sm:grid-cols-3">
        <div>
          <div className="font-display text-lg text-white">{BRAND.name}</div>
          <p className="mt-2 text-sm">
            We source carnival rides and operating crews from established operators, send a written quote, and
            coordinate your booking. Placeholder brand — development build.
          </p>
        </div>
        <div className="text-sm">
          <div className="font-semibold text-white">Rides</div>
          <ul className="mt-2 space-y-1">
            <li><Link href={paths.rides()} className="hover:text-white">All ride rentals</Link></li>
            <li><Link href={paths.request()} className="hover:text-white">Start an event request</Link></li>
          </ul>
        </div>
        <div className="text-xs text-white/60">
          Prices shown before sourcing are estimates. Availability is confirmed only when an operator commits to your
          date and you accept a written quote.
        </div>
      </div>
    </footer>
  );
}
