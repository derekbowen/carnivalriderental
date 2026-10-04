import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRightIcon, SearchIcon } from 'lucide-react';
import { FulfillmentTimeline } from '../components/status/FulfillmentTimeline';
import { PaymentStatusRow } from '../components/status/PaymentStatusRow';
import { PlaceholderImage } from '../components/PlaceholderImage';
import { PriceKindLabel } from '../components/PriceKindLabel';
import { useSubmittedRequests } from '../contexts/SubmittedRequestsContext';
import { demoCustomerRequest } from '../data/demoCustomerRequest';
import { fulfillmentStages } from '../data/statusStages';
import { rides } from '../data/rides';
import { brand } from '../data/brand';
import { formatRange, formatUSD } from '../utils/currency';
import { statusFromSubmitted } from '../utils/customerStatus';

export function RequestStatus() {
  const { reference = '' } = useParams();
  const navigate = useNavigate();
  const { submitted } = useSubmittedRequests();
  const [lookup, setLookup] = useState('');

  const sub = submitted[reference];
  const record = sub ? statusFromSubmitted(sub) : reference.toUpperCase() === demoCustomerRequest.reference ? demoCustomerRequest : null;
  const ride = record?.rideSlug ? rides.find((r) => r.slug === record.rideSlug) : undefined;

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (lookup.trim()) navigate(`/status/${lookup.trim().toUpperCase()}`);
  };

  const lookupForm = (
    <form onSubmit={handleLookup} className="flex w-full max-w-md gap-2" role="search" aria-label="Find a request">
      <label htmlFor="ref-lookup" className="sr-only">Reference number</label>
      <input
        id="ref-lookup"
        value={lookup}
        onChange={(e) => setLookup(e.target.value)}
        placeholder={`e.g. ${demoCustomerRequest.reference}`}
        className="flex-1 rounded-md border border-ivory/20 bg-midnight-2 px-3.5 py-2.5 text-sm text-ivory placeholder:text-ivory/40 focus:outline-none focus:ring-2 focus:ring-gold"
      />
      <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-gold px-4 text-sm font-semibold text-midnight hover:bg-gold-soft">
        <SearchIcon size={15} aria-hidden="true" /> Find
      </button>
    </form>
  );

  if (!record) {
    return (
      <div className="bg-midnight text-ivory">
        <div className="mx-auto flex max-w-2xl flex-col items-center px-5 py-28 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold">Track a request</p>
          <h1 className="mt-4 font-display text-4xl">{reference ? `We couldn't find ${reference}` : 'Find your request'}</h1>
          <p className="mt-4 text-ivory/65">Enter the reference number from your confirmation email.</p>
          <div className="mt-8 flex w-full justify-center">{lookupForm}</div>
        </div>
      </div>
    );
  }

  const currentStage = fulfillmentStages[Math.min(record.completedStages, fulfillmentStages.length - 1)];
  const confirmed = record.completedStages >= fulfillmentStages.length;

  return (
    <div className="bg-ivory">
      <section className="bg-midnight text-ivory">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 px-5 py-12 sm:px-8 lg:flex-row lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold">Request status · {record.reference}</p>
            <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">
              {confirmed ? 'Booking confirmed' : currentStage.label}
            </h1>
            <p className="mt-3 max-w-2xl text-ivory/70">{record.latestUpdate}</p>
          </div>
          {lookupForm}
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-8">
          <section aria-labelledby="fulfillment-heading" className="rounded-2xl border border-line bg-white p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
              <h2 id="fulfillment-heading" className="font-display text-2xl">Booking progress</h2>
              <p className="text-sm text-muted">
                {confirmed ? 'Confirmed' : 'Not confirmed until an operator commits'}
              </p>
            </div>
            <div className="mt-8">
              <FulfillmentTimeline completed={record.completedStages} dates={record.stageDates} />
            </div>
          </section>

          <PaymentStatusRow status={record.payment} note={record.paymentNote} />
        </div>

        <aside className="space-y-6 lg:col-span-4">
          <div className="overflow-hidden rounded-2xl border border-line bg-white">
            <PlaceholderImage glyph={ride?.glyph ?? 'package'} caption={record.rideName} className="aspect-[16/9]" />
            <div className="p-6">
              <h2 className="font-display text-xl">{record.rideName}</h2>
              <dl className="mt-4 space-y-2.5 text-sm">
                {[
                  ['Event date', record.eventDateLabel],
                  ['Location', record.location],
                  ['Venue', record.venue],
                  ['Event type', record.eventType],
                  ['Attendance', record.attendance],
                  ['Coordinator', record.coordinator],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <dt className="text-muted">{label}</dt>
                    <dd className="text-right font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5 border-t border-line pt-5">
                {record.acceptedQuote !== null ? (
                  <>
                    <p className="font-display text-3xl">{formatUSD(record.acceptedQuote)}</p>
                    <PriceKindLabel kind="accepted" className="mt-2" />
                  </>
                ) : record.estimate ? (
                  <>
                    <p className="font-display text-2xl">{formatRange(record.estimate.min, record.estimate.max)}</p>
                    <PriceKindLabel kind="estimate" className="mt-2" />
                  </>
                ) : (
                  <p className="text-sm text-muted">Pricing will appear once we send your written quote.</p>
                )}
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-sand/70 p-6 text-sm">
            <p className="font-medium">Need to change something?</p>
            <p className="mt-1 text-muted">
              Email <a href={`mailto:${brand.email}`} className="underline">{brand.email}</a> with reference {record.reference}.
            </p>
            {record.rideSlug && (
              <Link to={`/rides/${record.rideSlug}`} className="mt-4 inline-flex items-center gap-1.5 font-semibold text-gold-deep hover:underline">
                View ride details <ArrowRightIcon size={14} aria-hidden="true" />
              </Link>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
