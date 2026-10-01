import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, ArrowUpRightIcon } from 'lucide-react';
import { categories } from '../../data/categories';
import { rides } from '../../data/rides';
import { PlaceholderImage } from '../PlaceholderImage';

export function CategoryGrid() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10" aria-labelledby="categories-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="categories-heading" className="font-display text-4xl tracking-tight text-ink">
            Browse by ride type
          </h2>
          <p className="mt-2 max-w-lg text-ink-muted">
            Rides listed from carnival operators nationwide — compare them all right here.
          </p>
        </div>
        <Link to="/rides" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink hover:text-accent-ink">
          View all rides <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
        {categories.map((cat, i) => {
          const count = rides.filter((r) => r.categoryId === cat.id).length;
          const featured = i === 0;
          const content =
          <>
              <PlaceholderImage
              className={`w-full rounded-xl ${featured ? 'aspect-[4/3] lg:aspect-auto lg:min-h-[360px] lg:flex-1' : 'aspect-[16/10]'}`}
              compact={!featured}
              label={cat.name} />
            
              <div className="mt-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className={`font-display text-ink ${featured ? 'text-3xl' : 'text-xl'}`}>{cat.name}</h3>
                  <p className="mt-1 text-sm text-ink-muted">{cat.description}</p>
                </div>
                {cat.comingLater ?
              <span className="shrink-0 whitespace-nowrap rounded-full border border-line-strong px-2.5 py-1 text-xs font-medium text-ink-muted">
                    Coming later
                  </span> :

              <span className="mt-1 shrink-0 whitespace-nowrap text-xs text-ink-muted">
                    {count} {count === 1 ? 'ride' : 'rides'}
                  </span>
              }
              </div>
            </>;

          const span = featured ? 'lg:col-span-2 lg:row-span-2' : '';
          if (cat.comingLater) {
            return (
              <div key={cat.id} className={`flex flex-col opacity-70 ${span}`} aria-disabled="true">
                {content}
              </div>);

          }
          return (
            <Link
              key={cat.id}
              to={`/rides?category=${cat.id}`}
              className={`group relative flex flex-col ${span}`}>
              
              {content}
              <ArrowUpRightIcon
                className="absolute right-3 top-3 h-8 w-8 rounded-full bg-surface p-2 text-ink opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                aria-hidden="true" />
              
            </Link>);

        })}
      </div>
    </section>);

}