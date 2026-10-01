import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { LockIcon, MenuIcon, XIcon } from 'lucide-react';
import { BrandMark } from '../BrandMark';
import { demoCustomerRequest } from '../../data/demoCustomerRequest';

const links = [
  { to: '/rides', label: 'Rides' },
  { to: '/#how-it-works', label: 'How it works' },
  { to: '/request', label: 'Event request' },
  { to: `/status/${demoCustomerRequest.reference}`, label: 'Track a request' },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm transition-colors ${isActive ? 'text-gold-soft' : 'text-ivory/75 hover:text-ivory'}`;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname, location.hash]);

  return (
    <header className="sticky top-0 z-40 border-b border-ivory/10 bg-midnight text-ivory">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link to="/" className="shrink-0 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-gold" aria-label="Home">
          <BrandMark />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-8 lg:flex">
          {links.map((l) =>
            l.to.includes('#') ? (
              <Link key={l.to} to={l.to} className="text-sm text-ivory/75 transition-colors hover:text-ivory">
                {l.label}
              </Link>
            ) : (
              <NavLink key={l.to} to={l.to} className={linkClass} end={l.to === '/request'}>
                {l.label}
              </NavLink>
            ),
          )}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <NavLink
            to="/internal"
            className={({ isActive }) =>
              `inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                isActive ? 'border-gold text-gold' : 'border-ivory/20 text-ivory/60 hover:border-ivory/40 hover:text-ivory'
              }`
            }
          >
            <LockIcon size={12} aria-hidden="true" />
            Internal
          </NavLink>
          <Link
            to="/request"
            className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-midnight transition-colors hover:bg-gold-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-soft focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
          >
            Start an event request
          </Link>
        </div>

        <button
          type="button"
          className="rounded p-2 text-ivory lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <XIcon size={22} /> : <MenuIcon size={22} />}
        </button>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-ivory/10 px-5 pb-6 pt-2 lg:hidden">
          <ul className="flex flex-col">
            {links.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="block border-b border-ivory/10 py-3 text-ivory/85">
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <Link to="/internal" className="flex items-center gap-2 border-b border-ivory/10 py-3 text-ivory/60">
                <LockIcon size={14} aria-hidden="true" /> Internal (staff only)
              </Link>
            </li>
          </ul>
          <Link to="/request" className="mt-5 block rounded-md bg-gold px-4 py-3 text-center font-semibold text-midnight">
            Start an event request
          </Link>
        </nav>
      )}
    </header>
  );
}
