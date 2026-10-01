import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRightIcon, InboxIcon } from 'lucide-react';
import type { EventRequestForm } from '../types/request';
import { rides } from '../data/rides';
import { customerRequest } from '../data/customerRequest';
import { primaryButtonClass, secondaryButtonClass } from '../utils/formStyles';

const nextSteps = [
{ title: 'We review your brief', body: 'We may contact you with questions about the site, timing or audience.' },
{ title: 'We lock in the operator', body: 'We offer the job to the closest operator with this ride. If they say no, we go to the next closest.' },
{ title: 'You approve the final scope and price', body: 'You receive an itemized quote. Nothing is booked until you accept it.' },
{ title: 'Booking confirmed', body: 'Confirmed under the payment terms set out in your accepted quote.' }];


export function RequestReceived() {
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const form = (location.state as {form?: EventRequestForm;} | null)?.form;
  const rideName = form ? rides.find((r) => r.slug === form.rideSlug)?.name ?? 'Ride to be recommended' : customerRequest.rideName;

  return (
    <div className="mx-auto max-w-3xl px-6 pb-24 pt-16">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}>
        
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
          <InboxIcon className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="mt-6 font-display text-5xl tracking-tight text-ink">Request received — not yet booked</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-ink-soft">
          Thank you{form?.name ? `, ${form.name.split(' ')[0]}` : ''}. Your request for{' '}
          <span className="font-medium text-ink">{rideName}</span> is with our fulfilment team. No ride has been reserved
          and nothing has been charged.
        </p>

        <dl className="mt-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
          <div className="bg-surface p-4">
            <dt className="text-xs text-ink-muted">Reference</dt>
            <dd className="mt-1 font-mono text-sm font-medium text-ink">{customerRequest.reference}</dd>
          </div>
          <div className="bg-surface p-4">
            <dt className="text-xs text-ink-muted">Fulfilment status</dt>
            <dd className="mt-1 text-sm font-medium text-ink">Request received</dd>
          </div>
          <div className="bg-surface p-4">
            <dt className="text-xs text-ink-muted">Payment status</dt>
            <dd className="mt-1 text-sm font-medium text-ink">No payment due</dd>
          </div>
        </dl>

        <h2 className="mt-14 font-display text-3xl text-ink">What happens next</h2>
        <ol className="mt-6 space-y-6">
          {nextSteps.map((s, i) =>
          <li key={s.title} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-strong font-display text-lg text-ink">
                {i + 1}
              </span>
              <div>
                <h3 className="font-semibold text-ink">{s.title}</h3>
                <p className="mt-0.5 text-[15px] text-ink-muted">{s.body}</p>
              </div>
            </li>
          )}
        </ol>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link to={`/requests/${customerRequest.reference}`} className={primaryButtonClass}>
            Track this request <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link to="/rides" className={secondaryButtonClass}>
            Back to rides
          </Link>
        </div>
      </motion.div>
    </div>);

}