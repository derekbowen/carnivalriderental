import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarIcon, FerrisWheelIcon, MapPinIcon, SearchIcon } from 'lucide-react';
import { categories } from '../../data/categories';
import { usStates } from '../../data/states';
import { PlaceholderImage } from '../PlaceholderImage';
import { inputClass, primaryButtonClass } from '../../utils/formStyles';

export function Hero() {
  const navigate = useNavigate();
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    const statePart = location.split(',')[1]?.trim().toLowerCase();
    const match = usStates.find((s) => s.code.toLowerCase() === statePart || s.name.toLowerCase() === statePart);
    if (match) params.set('state', match.code);
    navigate(`/rides${params.toString() ? `?${params}` : ''}`);
  };

  return (
    <section className="bg-ink text-white">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 pb-20 pt-12 lg:grid-cols-12 lg:gap-14 lg:px-10 lg:pb-24 lg:pt-16">
        <div className="lg:col-span-6">
          <h1 className="font-display text-[46px] leading-[0.98] text-white sm:text-[60px] lg:text-[72px]">
            Every carnival ride. <span className="text-accent">All in one place.</span>
          </h1>
          <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-white/80">
            We list rides from carnival operators across the country. Pick the ride, give us your date — we lock in the
            operator, handle the money and get it to your event. No more searching online forever.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-8 rounded-2xl bg-surface p-5 text-ink shadow-[0_24px_48px_-24px_rgba(0,0,0,0.5)]"
            aria-label="Find rides">
            
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">Ride</span>
                <span className="relative block">
                  <FerrisWheelIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pop" aria-hidden="true" />
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputClass} pl-9`}>
                    <option value="">Any ride</option>
                    {categories.
                    filter((c) => !c.comingLater).
                    map((c) =>
                    <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                    )}
                  </select>
                </span>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">Event location</span>
                <span className="relative block">
                  <MapPinIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pop" aria-hidden="true" />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="City, state"
                    className={`${inputClass} pl-9`} />
                  
                </span>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">Event date</span>
                <span className="relative block">
                  <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pop" aria-hidden="true" />
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputClass} pl-9`} />
                </span>
              </label>
            </div>
            <button type="submit" className={`${primaryButtonClass} mt-4 w-full`}>
              <SearchIcon className="h-4 w-4" aria-hidden="true" />
              Find rides
            </button>
            <p className="mt-3 text-center text-sm text-ink-muted">
              Know what you need?{' '}
              <Link to="/request" className="font-semibold text-ink underline underline-offset-4 hover:text-pop">
                Start an event request
              </Link>
            </p>
          </form>
        </div>

        <div className="lg:col-span-6">
          <PlaceholderImage className="aspect-[4/3] w-full rounded-2xl" label="Lit-up Ferris wheel at an evening event" />
          <div className="mt-4 grid grid-cols-3 gap-4">
            <PlaceholderImage className="aspect-[4/3] rounded-xl" compact label="Carousel detail" />
            <PlaceholderImage className="aspect-[4/3] rounded-xl" compact label="Swing ride at dusk" />
            <PlaceholderImage className="aspect-[4/3] rounded-xl" compact label="Crew setting up a ride" />
          </div>
        </div>
      </div>
    </section>);

}