import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon } from 'lucide-react';
import { Hero } from '../components/home/Hero';
import { CategoryGrid } from '../components/home/CategoryGrid';
import { HowItWorks } from '../components/home/HowItWorks';
import { TrustSection } from '../components/home/TrustSection';
import { PlaceholderImage } from '../components/PlaceholderImage';
import { primaryButtonClass } from '../utils/formStyles';

export function Home() {
  return (
    <>
      <Hero />
      <CategoryGrid />
      <HowItWorks />
      <TrustSection />
      <section className="mx-auto max-w-7xl px-6 pb-24 lg:px-10" aria-labelledby="cta-heading">
        <div className="grid overflow-hidden rounded-2xl border border-line bg-surface md:grid-cols-2">
          <div className="flex flex-col justify-center p-8 lg:p-12">
            <h2 id="cta-heading" className="font-display text-3xl tracking-tight text-ink lg:text-4xl">
              Planning more than eight weeks out?
            </h2>
            <p className="mt-3 max-w-md text-ink-muted">
              Larger rides have limited availability nationally. An early request gives us the widest choice of
              qualified operators for your dates.
            </p>
            <Link to="/request" className={`${primaryButtonClass} mt-6 self-start`}>
              Start an event request <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <PlaceholderImage className="aspect-[16/10] md:aspect-auto md:min-h-[320px]" label="Festival grounds at golden hour" />
        </div>
      </section>
    </>);

}