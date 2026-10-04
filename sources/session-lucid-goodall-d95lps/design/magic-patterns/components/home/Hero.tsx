import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRightIcon, CalendarIcon, MapPinIcon } from 'lucide-react';
import { PlaceholderImage } from '../PlaceholderImage';
import { PriceKindLabel } from '../PriceKindLabel';
import { rides } from '../../data/rides';
import { formatRange } from '../../utils/currency';
import { todayISO } from '../../utils/date';

const featured = rides[0];

export function Hero() {
  const navigate = useNavigate();
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (location.trim()) params.set('location', location.trim());
    if (date) params.set('date', date);
    navigate(`/request${params.toString() ? `?${params}` : ''}`);
  };

  return (
    <section className="bg-midnight text-ivory">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 pb-16 pt-12 sm:px-8 lg:grid-cols-12 lg:gap-14 lg:pb-24 lg:pt-20">
        <div className="flex flex-col justify-center lg:col-span-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold">Managed event ride rentals</p>
          <h1 className="mt-5 font-display text-4xl font-normal leading-[1.06] tracking-tight sm:text-5xl xl:text-[3.6rem]">
            Carnival ride rentals for your event — <span className="italic text-gold-soft">we source, quote and coordinate</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ivory/70">
            Tell us where and when. Our team sources a ride and operating crew from vetted carnival operators and sends
            you a written quote. Nothing is booked until you accept the scope and an operator commits.
          </p>

          <form onSubmit={handleSubmit} className="mt-10 rounded-xl bg-ivory p-2 text-ink shadow-2xl shadow-black/30" aria-label="Start an event request">
            <div className="grid gap-2 md:grid-cols-[1.3fr_1fr_auto]">
              <label className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 ring-1 ring-line focus-within:ring-2 focus-within:ring-gold">
                <MapPinIcon size={18} className="shrink-0 text-gold-deep" aria-hidden="true" />
                <span className="flex flex-1 flex-col">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Event location</span>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="City, State"
                    className="bg-transparent text-[15px] placeholder:text-muted/60 focus:outline-none"
                  />
                </span>
              </label>
              <label className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 ring-1 ring-line focus-within:ring-2 focus-within:ring-gold">
                <CalendarIcon size={18} className="shrink-0 text-gold-deep" aria-hidden="true" />
                <span className="flex flex-1 flex-col">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Event date</span>
                  <input
                    type="date"
                    min={todayISO()}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-transparent text-[15px] focus:outline-none"
                  />
                </span>
              </label>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-midnight px-6 py-4 text-sm font-semibold text-ivory transition-colors hover:bg-midnight-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                Start an event request <ArrowRightIcon size={16} aria-hidden="true" />
              </button>
            </div>
          </form>
          <p className="mt-4 text-sm text-ivory/50">
            A request is not a booking. You'll receive a written quote before anything is confirmed.
          </p>
        </div>

        <div className="relative lg:col-span-6">
          <PlaceholderImage
            glyph="ferris"
            size="lg"
            caption="Hero — Ferris wheel at an evening event"
            className="aspect-[4/3] rounded-2xl ring-1 ring-ivory/10 lg:aspect-auto lg:h-full lg:min-h-[540px]"
          />
          <Link
            to={`/rides/${featured.slug}`}
            className="group absolute bottom-5 right-5 hidden max-w-xs rounded-xl bg-ivory p-4 text-ink shadow-xl sm:block"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{featured.rideType}</p>
            <p className="mt-1 font-display text-lg">{featured.name}</p>
            <p className="mt-2 text-sm">Estimate from {formatRange(featured.estimateMin, featured.estimateMax)}</p>
            <PriceKindLabel kind="estimate" className="mt-2" />
            <span className="mt-3 flex items-center gap-1 text-sm font-semibold text-gold-deep group-hover:underline">
              View ride <ArrowRightIcon size={14} aria-hidden="true" />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
