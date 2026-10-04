import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, ArrowUpRightIcon } from 'lucide-react';
import { PlaceholderImage } from '../PlaceholderImage';
import { PriceKindLabel } from '../PriceKindLabel';
import { categories } from '../../data/categories';
import { formatUSD } from '../../utils/currency';

export function CategoryGrid() {
  return (
    <section className="bg-ivory py-20 lg:py-28" aria-labelledby="categories-heading">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-deep">Ride categories</p>
            <h2 id="categories-heading" className="mt-4 font-display text-3xl leading-tight sm:text-4xl lg:text-5xl">
              Choose a centerpiece, or let us build the whole midway
            </h2>
          </div>
          <Link to="/rides" className="inline-flex items-center gap-2 text-sm font-semibold text-ink hover:text-gold-deep">
            Browse all rides <ArrowRightIcon size={16} aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-12 grid gap-x-6 gap-y-10 md:grid-cols-2 lg:grid-cols-6">
          {categories.map((c, i) => (
            <Link
              key={c.id}
              to={`/rides?category=${c.id}`}
              className={`group rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-4 focus-visible:ring-offset-ivory ${
                i < 2 ? 'lg:col-span-3' : 'lg:col-span-2'
              }`}
            >
              <PlaceholderImage
                glyph={c.glyph}
                caption={`${c.name} — category image`}
                className={`rounded-xl transition-transform duration-300 group-hover:-translate-y-1 ${i < 2 ? 'aspect-[16/10]' : 'aspect-[4/3]'}`}
              />
              <div className="mt-5 flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-display text-2xl">{c.name}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{c.blurb}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                    <span>Estimates from {formatUSD(c.estimateFrom)}</span>
                    <PriceKindLabel kind="estimate" />
                  </div>
                </div>
                <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line transition-colors group-hover:border-midnight group-hover:bg-midnight group-hover:text-ivory">
                  <ArrowUpRightIcon size={16} aria-hidden="true" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
