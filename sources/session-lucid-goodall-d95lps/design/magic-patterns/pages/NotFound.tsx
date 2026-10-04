import React from 'react';
import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center px-6 py-32 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold-deep">Page not found</p>
      <h1 className="mt-4 font-display text-4xl">We couldn't find that page</h1>
      <p className="mt-4 text-muted">The link may be out of date. Try browsing rides or starting an event request.</p>
      <div className="mt-8 flex gap-3">
        <Link to="/rides" className="rounded-md border border-midnight px-5 py-2.5 text-sm font-semibold">Browse rides</Link>
        <Link to="/request" className="rounded-md bg-midnight px-5 py-2.5 text-sm font-semibold text-ivory">Start an event request</Link>
      </div>
    </section>
  );
}
