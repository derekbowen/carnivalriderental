import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRightIcon, CheckIcon, CopyIcon } from 'lucide-react';
import { useSubmittedRequests } from '../contexts/SubmittedRequestsContext';
import { brand } from '../data/brand';
import { dateLabel, locationLabel, rideLabel } from '../utils/draftSummary';

const nextSteps = [
  { title: 'We review your brief', text: 'A coordinator checks your event details and may follow up with questions.' },
  { title: 'We source operators', text: 'We contact carnival operators who may be able to serve your date and site.' },
  { title: 'You receive a written quote', text: 'Itemized scope and price. Nothing is booked until you accept it and an operator commits.' },
];

export function RequestSubmitted() {
  const { reference = '' } = useParams();
  const { submitted } = useSubmittedRequests();
  const sub = submitted[reference];
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="bg-ivory">
      <section className="bg-midnight text-ivory">
        <div className="mx-auto max-w-3xl px-5 py-16 text-center sm:px-8 lg:py-24">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold/15 ring-1 ring-gold/40">
            <CheckIcon size={26} className="text-gold" aria-hidden="true" />
          </span>
          <h1 className="mt-8 font-display text-4xl leading-tight sm:text-5xl">Request received — this is not a booking yet</h1>
          <p className="mx-auto mt-5 max-w-xl text-ivory/70">
            Thanks{sub?.draft.name ? `, ${sub.draft.name.split(' ')[0]}` : ''}. Our team will start sourcing operators
            for your event. No ride is reserved and no payment has been taken.
          </p>

          <div className="mx-auto mt-10 inline-flex items-center gap-4 rounded-xl bg-midnight-2 px-6 py-4 ring-1 ring-ivory/15">
            <div className="text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">Reference number</p>
              <p className="mt-1 font-display text-3xl tracking-wide">{reference}</p>
            </div>
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-md border border-ivory/20 px-3 py-2 text-sm text-ivory/80 hover:border-ivory/40 hover:text-ivory"
            >
              {copied ? <CheckIcon size={14} aria-hidden="true" /> : <CopyIcon size={14} aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <span className="sr-only" aria-live="polite">{copied ? 'Reference copied' : ''}</span>
        </div>
      </section>

      <div className="mx-auto grid max-w-5xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-5">
        <section className="lg:col-span-3" aria-labelledby="next-heading">
          <h2 id="next-heading" className="font-display text-2xl">What happens next</h2>
          <ol className="mt-6 space-y-5">
            {nextSteps.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="font-display text-3xl text-gold-deep">{i + 1}</span>
                <div>
                  <p className="font-medium">{s.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <Link
            to={`/status/${reference}`}
            className="mt-10 inline-flex items-center gap-2 rounded-md bg-midnight px-6 py-3.5 text-sm font-semibold text-ivory hover:bg-midnight-3"
          >
            View request status <ArrowRightIcon size={16} aria-hidden="true" />
          </Link>
        </section>

        <aside className="lg:col-span-2">
          <div className="rounded-2xl border border-line bg-white p-6">
            <h2 className="font-display text-xl">Request summary</h2>
            {sub ? (
              <dl className="mt-4 space-y-3 text-sm">
                <div><dt className="text-muted">Ride</dt><dd className="font-medium">{rideLabel(sub.draft)}</dd></div>
                <div><dt className="text-muted">Date</dt><dd className="font-medium">{dateLabel(sub.draft)}</dd></div>
                <div><dt className="text-muted">Location</dt><dd className="font-medium">{locationLabel(sub.draft)}</dd></div>
                <div><dt className="text-muted">Confirmation sent to</dt><dd className="font-medium">{sub.draft.email}</dd></div>
              </dl>
            ) : (
              <p className="mt-3 text-sm text-muted">Keep your reference number for any questions about this request.</p>
            )}
            <p className="mt-6 border-t border-line pt-4 text-xs text-muted">
              Questions? Email <a href={`mailto:${brand.email}`} className="underline">{brand.email}</a> with your reference.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
