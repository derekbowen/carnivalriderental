import React from 'react';
import { Link } from 'react-router-dom';
import { BrandMark } from '../BrandMark';
import { brand } from '../../data/brand';
import { categories } from '../../data/categories';

export function SiteFooter() {
  return (
    <footer className="bg-midnight text-ivory">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <BrandMark />
          <p className="mt-5 max-w-md text-sm leading-relaxed text-ivory/60">
            {brand.name} manages each booking. We source rides and operating crews from independent carnival operators,
            send a written quote, and confirm only after you accept the final scope and an operator commits to your date.
          </p>
          <p className="mt-4 max-w-md text-xs leading-relaxed text-ivory/40">
            Prices on this site are estimates until you accept a written quote. Ride availability is never guaranteed
            before an operator commits.
          </p>
        </div>
        <div className="lg:col-span-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">Rides</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {categories.map((c) => (
              <li key={c.id}>
                <Link to={`/rides?category=${c.id}`} className="text-ivory/70 hover:text-ivory">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="lg:col-span-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">Planners</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link to="/#how-it-works" className="text-ivory/70 hover:text-ivory">How it works</Link></li>
            <li><Link to="/request" className="text-ivory/70 hover:text-ivory">Event request</Link></li>
            <li><Link to="/status/BAC-24817" className="text-ivory/70 hover:text-ivory">Track a request</Link></li>
          </ul>
        </div>
        <div className="lg:col-span-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">Contact</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-ivory/70">
            <li><a href={`mailto:${brand.email}`} className="hover:text-ivory">{brand.email}</a></li>
            <li>{brand.phone}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-ivory/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-xs text-ivory/40 sm:flex-row sm:justify-between sm:px-8">
          <p>© 2026 {brand.name} (working brand name)</p>
          <p>All imagery is development placeholder imagery.</p>
        </div>
      </div>
    </footer>
  );
}
