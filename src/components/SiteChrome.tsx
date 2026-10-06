import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { appEnv, BRAND, publicIndexingEnabled } from "@/lib/config";
import { FOOTER_CITIES, FOOTER_EVENTS, FOOTER_RIDE_TYPES, FOOTER_STATES, type FooterLink } from "@/lib/seo/footer-links";
import { paths } from "@/lib/seo/routes";

export function EnvBanner() {
  if (appEnv() === "production" && publicIndexingEnabled()) return null;
  return (
    <div className="bg-ink px-4 py-1.5 text-center text-xs text-white/85">
      <strong className="font-semibold text-accent">Preview</strong> · not yet indexed by search engines · ride listings are drawn from operators&rsquo; public information and are unconfirmed · payments are in test mode (no real charges)
    </div>
  );
}

function Logo({ dark = false }: { dark?: boolean }) {
  // Founder's logo (public/brand). The dark variant has white lettering for the navy footer.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={dark ? "/brand/logo-on-dark.png" : "/brand/logo-header.png"} alt={BRAND.name} width={127} height={48} className="h-12 w-auto" />
  );
}

const NAV = [
  { href: paths.search(), label: "Find a ride" },
  { href: paths.rides(), label: "Ride types" },
  { href: paths.directory(), label: "Locations" },
  { href: "/#how-it-works", label: "How it works" },
];

export function SiteHeader() {
  return (
    <header className="safe-top sticky top-0 z-40 border-b border-line bg-surface">
      <div className="awning h-1.5" aria-hidden="true" />
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
        <Link href="/" aria-label={`${BRAND.name} home`}><Logo /></Link>
        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {NAV.map((n) => <Link key={n.href} href={n.href} className="whitespace-nowrap text-sm text-ink-soft transition-colors hover:text-ink">{n.label}</Link>)}
          <Link href={paths.connect()} className="btn-primary !px-4 !py-2 text-sm">Connect with operators</Link>
        </nav>
        {/* No-JS mobile menu */}
        <details className="relative md:hidden">
          <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-md text-ink [&::-webkit-details-marker]:hidden" aria-label="Menu"><MenuIcon className="h-5 w-5" /></summary>
          <div className="absolute right-0 mt-2 w-60 rounded-xl border border-line bg-surface p-4 shadow-lg">
            <ul className="flex flex-col gap-3">
              {NAV.map((n) => <li key={n.href}><Link href={n.href} className="block py-1 text-[15px]">{n.label}</Link></li>)}
              <li><Link href={paths.connect()} className="btn-primary mt-1 w-full text-sm">Connect with operators</Link></li>
            </ul>
          </div>
        </details>
      </div>
    </header>
  );
}

const SUPPORT_EMAIL = `support@${BRAND.domain}`;

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <p className="font-semibold text-accent">{title}</p>
      <ul className="mt-3 space-y-2 text-white/75">
        {links.map((l) => (
          <li key={l.href}><Link className="hover:text-white" href={l.href}>{l.label}</Link></li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="safe-bottom mt-24 bg-ink text-white">
      <div className="awning h-3" aria-hidden="true" />
      {/* Operator side, on every page (mirrored by operatorProgramNode in every JSON-LD graph). */}
      <div data-testid="operator-strip" className="border-b border-white/10">
        <p className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-4 text-sm text-white/80 sm:px-6 lg:px-10">
          <strong className="text-white">Own a carnival ride?</strong>
          <span>List it on {BRAND.name} and set your own price. Terms are confirmed in writing before you list.</span>
          <Link href={paths.operators()} className="font-semibold text-accent hover:underline">Apply for early access →</Link>
        </p>
      </div>
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-12 lg:px-10">
        <div className="lg:col-span-4">
          <Logo dark />
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/70">
            Carnival ride inventory from independent operators across the US. Find the ride, then connect with the company that owns it.
          </p>
          <p className="mt-5 text-sm text-white/70">
            Questions? <a className="font-semibold text-white hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </p>
          <Link href={paths.connect()} className="btn-primary mt-5 inline-flex">Connect with operators</Link>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-4 lg:col-span-8">
          <FooterColumn title="Ride types" links={FOOTER_RIDE_TYPES} />
          <FooterColumn title="Popular cities" links={FOOTER_CITIES} />
          <FooterColumn title="Events" links={FOOTER_EVENTS} />
          <FooterColumn
            title="Carnival Ride Rental"
            links={[
              { href: paths.search(), label: "Find a ride" },
              { href: "/#how-it-works", label: "How it works" },
              { href: paths.operators(), label: "For ride operators" },
              { href: paths.directory(), label: "Site directory" },
              { href: paths.contact(), label: "Contact" },
              { href: paths.accessPolicy(), label: "Event Access policy" },
              { href: paths.terms(), label: "Terms of Use" },
              { href: paths.privacy(), label: "Privacy" },
            ]}
          />
        </nav>
      </div>
      <nav aria-label="Browse locations" className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
          <p className="text-sm font-semibold text-accent">Carnival ride rentals by state</p>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-white/65">
            {FOOTER_STATES.map((l) => (
              <li key={l.href}><Link className="hover:text-white" href={l.href}>{l.label}</Link></li>
            ))}
            <li><Link className="font-semibold text-accent hover:underline" href={paths.directory()}>All locations →</Link></li>
          </ul>
        </div>
      </nav>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-white/60 sm:px-6 lg:px-10">
          {BRAND.name} is owned and operated by {BRAND.legalEntity}. Operators are independent businesses who own and run the rides listed here. Event Access sells contact details, not the rental: price, availability, contract and payment are agreed directly with the operator.
        </p>
      </div>
    </footer>
  );
}
