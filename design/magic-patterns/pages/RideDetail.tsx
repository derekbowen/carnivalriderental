import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeftIcon } from 'lucide-react';
import { RideGallery } from '../components/rides/RideGallery';
import { SpecTable } from '../components/rides/SpecTable';
import { SourcingStatusPanel } from '../components/rides/SourcingStatusPanel';
import { EstimatePanel } from '../components/rides/EstimatePanel';
import { SourcingChip } from '../components/SourcingChip';
import { PriceKindLabel } from '../components/PriceKindLabel';
import { rides } from '../data/rides';
import { categories } from '../data/categories';
import { formatRange } from '../utils/currency';

export function RideDetail() {
  const { slug } = useParams();
  const ride = rides.find((r) => r.slug === slug);

  if (!ride) {
    return (
      <section className="mx-auto max-w-xl px-6 py-32 text-center">
        <h1 className="font-display text-4xl">Ride not found</h1>
        <p className="mt-4 text-muted">This ride may have been renamed. Browse all rides or tell us what you're looking for.</p>
        <Link to="/rides" className="mt-8 inline-block rounded-md bg-midnight px-5 py-2.5 text-sm font-semibold text-ivory">
          Browse rides
        </Link>
      </section>
    );
  }

  const category = categories.find((c) => c.id === ride.categoryId);

  return (
    <div className="bg-ivory pb-28 lg:pb-0">
      <div className="mx-auto max-w-7xl px-5 pt-8 sm:px-8">
        <Link to={category ? `/rides?category=${category.id}` : '/rides'} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeftIcon size={15} aria-hidden="true" /> {category ? category.name : 'All rides'}
        </Link>

        <div className="mt-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-deep">{ride.rideType}</p>
            <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">{ride.name}</h1>
          </div>
          <SourcingChip />
        </div>

        <div className="mt-8">
          <RideGallery glyph={ride.glyph} captions={ride.gallery} />
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-14 sm:px-8 lg:grid-cols-12">
        <div className="space-y-14 lg:col-span-8">
          <section aria-labelledby="about-heading">
            <h2 id="about-heading" className="font-display text-2xl">About this ride</h2>
            <div className="mt-4 space-y-4 text-[16px] leading-relaxed text-ink/80">
              {ride.description.map((p) => (
                <p key={p.slice(0, 24)}>{p}</p>
              ))}
            </div>
          </section>

          <section aria-labelledby="suitability-heading">
            <h2 id="suitability-heading" className="font-display text-2xl">Event suitability</h2>
            <dl className="mt-5 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
              {ride.suitability.map((s) => (
                <div key={s.label} className="bg-white p-5">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{s.label}</dt>
                  <dd className="mt-1.5 text-[15px]">{s.note}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="specs-heading">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
              <h2 id="specs-heading" className="font-display text-2xl">Specifications</h2>
              <p className="text-sm text-muted">Only rows marked "Verified spec" are confirmed details.</p>
            </div>
            <div className="mt-5">
              <SpecTable specs={ride.specs} />
            </div>
          </section>

          <SourcingStatusPanel />
        </div>

        <aside className="hidden lg:col-span-4 lg:block" aria-label="Estimate and request">
          <div className="sticky top-24">
            <EstimatePanel ride={ride} />
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ivory/10 bg-midnight px-5 py-3 text-ivory lg:hidden">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{formatRange(ride.estimateMin, ride.estimateMax)}</p>
            <PriceKindLabel kind="estimate" tone="dark" className="mt-1" />
          </div>
          <Link to={`/request?ride=${ride.slug}`} className="shrink-0 rounded-md bg-gold px-4 py-3 text-sm font-semibold text-midnight">
            Request this ride
          </Link>
        </div>
      </div>
    </div>
  );
}
