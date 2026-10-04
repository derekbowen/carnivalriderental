import React from 'react';
import { ArrowLeftIcon, ArrowRightIcon, LoaderCircleIcon } from 'lucide-react';
import { RequestStepper } from '../components/request/RequestStepper';
import { RideFlexibilityStep } from '../components/request/RideFlexibilityStep';
import { EventDetailsStep } from '../components/request/EventDetailsStep';
import { SiteBudgetStep } from '../components/request/SiteBudgetStep';
import { ContactStep } from '../components/request/ContactStep';
import { ReviewStep } from '../components/request/ReviewStep';
import { RequestSummary } from '../components/request/RequestSummary';
import { REVIEW_STEP, requestSteps, useEventRequest } from '../hooks/useEventRequest';

const stepIntros = [
  'Tell us which ride you have in mind and how flexible you can be.',
  'When and where is your event, and who is it for?',
  'A few site basics help us match the right operators.',
  'Where should we send your quote?',
  'Check the details below before you submit.',
];

export function EventRequest() {
  const form = useEventRequest();
  const { draft, update, errors, step } = form;
  const isReview = step === REVIEW_STEP;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReview) form.submit();
    else form.next();
  };

  return (
    <div className="bg-ivory">
      <section className="bg-midnight text-ivory">
        <div className="mx-auto max-w-7xl px-5 pb-10 pt-12 sm:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold">Event request</p>
          <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">Tell us about your event</h1>
          <p className="mt-3 max-w-2xl text-ivory/65">
            About four minutes. Submitting doesn't book anything — it starts our sourcing and leads to a written quote.
          </p>
          <div className="mt-10">
            <RequestStepper steps={requestSteps} current={step} furthest={form.furthest} onSelect={form.goTo} />
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-12">
        <form onSubmit={handleSubmit} noValidate className="lg:col-span-8" aria-labelledby="step-heading">
          <div className="rounded-2xl border border-line bg-white p-6 sm:p-10">
            <p className="text-sm text-muted">Step {step + 1} of {requestSteps.length}</p>
            <h2 id="step-heading" className="mt-1 font-display text-3xl">{requestSteps[step]}</h2>
            <p className="mt-2 text-muted">{stepIntros[step]}</p>
            <div className="mt-8">
              {step === 0 && <RideFlexibilityStep draft={draft} update={update} errors={errors} />}
              {step === 1 && <EventDetailsStep draft={draft} update={update} errors={errors} />}
              {step === 2 && <SiteBudgetStep draft={draft} update={update} errors={errors} />}
              {step === 3 && <ContactStep draft={draft} update={update} errors={errors} />}
              {isReview && (
                <ReviewStep
                  draft={draft}
                  errors={errors}
                  acknowledged={form.acknowledged}
                  onAcknowledge={form.toggleAcknowledged}
                  onEdit={form.goTo}
                />
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-4">
            {step > 0 ? (
              <button
                type="button"
                onClick={form.back}
                className="inline-flex items-center gap-2 rounded-md px-4 py-3 text-sm font-semibold text-ink hover:bg-sand"
              >
                <ArrowLeftIcon size={16} aria-hidden="true" /> Back
              </button>
            ) : (
              <span />
            )}
            <button
              type="submit"
              disabled={form.submitting}
              className="inline-flex items-center gap-2 rounded-md bg-midnight px-6 py-3.5 text-sm font-semibold text-ivory transition-colors hover:bg-midnight-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 disabled:opacity-70"
            >
              {form.submitting ? (
                <>
                  <LoaderCircleIcon size={16} className="animate-spin" aria-hidden="true" /> Submitting request…
                </>
              ) : isReview ? (
                'Submit request'
              ) : (
                <>
                  {step === 3 ? 'Review request' : 'Continue'} <ArrowRightIcon size={16} aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </form>

        <aside className="lg:col-span-4" aria-label="Request summary">
          <div className="lg:sticky lg:top-24">
            <RequestSummary draft={draft} />
          </div>
        </aside>
      </div>
    </div>
  );
}
