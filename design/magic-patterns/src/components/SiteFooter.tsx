import React from 'react';
import { Link } from 'react-router-dom';
import { FerrisWheelIcon, LockIcon } from 'lucide-react';

export function SiteFooter() {
  return (
    <footer className="bg-ink text-white">
      <div className="awning h-3" aria-hidden="true" />
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-12 lg:px-10">
        <div className="md:col-span-5">
          <p className="flex items-center gap-2 font-display text-2xl">
            <FerrisWheelIcon className="h-6 w-6 text-accent" aria-hidden="true" />
            Book a Carnival
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/70">
            The central booking system for carnival rides. Every listed ride in one place — you book and pay through
            us, and we lock in the operator.
          </p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-8 text-sm md:col-span-7 md:grid-cols-3">
          <div>
            <p className="font-semibold text-accent">Rides</p>
            <ul className="mt-3 space-y-2 text-white/75">
              <li><Link className="hover:text-white" to="/rides?category=ferris-wheels">Ferris wheels</Link></li>
              <li><Link className="hover:text-white" to="/rides?category=carousels">Carousels</Link></li>
              <li><Link className="hover:text-white" to="/rides?category=swing-rides">Swing rides</Link></li>
              <li><Link className="hover:text-white" to="/rides?category=kiddie-rides">Kiddie rides</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-accent">Booking</p>
            <ul className="mt-3 space-y-2 text-white/75">
              <li><Link className="hover:text-white" to="/#how-it-works">How managed booking works</Link></li>
              <li><Link className="hover:text-white" to="/request">Start an event request</Link></li>
              <li><Link className="hover:text-white" to="/requests/BAC-2026-0148">Track a request</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-accent">Team</p>
            <ul className="mt-3 space-y-2 text-white/75">
              <li>
                <Link className="inline-flex items-center gap-1.5 hover:text-white" to="/internal">
                  <LockIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  Internal fulfilment
                </Link>
              </li>
            </ul>
          </div>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-6 py-5 text-xs text-white/60 lg:px-10">
          “Book a Carnival” is a working name. All prices shown are planning estimates unless labelled “Accepted quote”.
        </p>
      </div>
    </footer>);

}