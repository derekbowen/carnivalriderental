import React from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { ArrowUpRightIcon, LockIcon } from 'lucide-react';

export function InternalLayout() {
  return (
    <div className="min-h-screen w-full bg-canvas text-ink">
      <div className="bg-accent px-6 py-1.5 text-center text-xs font-semibold uppercase tracking-[0.14em] text-ink">
        Internal — team only · Not visible to customers
      </div>
      <header className="bg-ink text-canvas">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-6 px-6 lg:px-10">
          <div className="flex items-center gap-6">
            <Link to="/internal" className="flex items-center gap-2.5">
              <LockIcon className="h-4 w-4 text-accent" aria-hidden="true" />
              <span className="font-display text-lg">Book a Carnival</span>
              <span className="rounded bg-canvas/10 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent">
                Internal
              </span>
            </Link>
            <nav aria-label="Internal" className="hidden sm:block">
              <NavLink
                to="/internal"
                end
                className={({ isActive }) => `text-sm ${isActive ? 'text-canvas' : 'text-canvas/70 hover:text-canvas'}`}>
                
                Fulfilment queue
              </NavLink>
            </nav>
          </div>
          <Link to="/" className="inline-flex items-center gap-1 whitespace-nowrap text-sm text-canvas/70 hover:text-canvas">
            Customer site <ArrowUpRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>);

}