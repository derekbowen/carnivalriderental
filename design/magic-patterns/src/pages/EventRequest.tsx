import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeftIcon, ArrowRightIcon, Loader2Icon } from 'lucide-react';
import { rides } from '../data/rides';
import { usStates } from '../data/states';
import { requestSteps } from '../data/requestOptions';
import { REVIEW_STEP, useEventRequest } from '../hooks/useEventRequest';
import { FormStepper } from '../components/request/FormStepper';
import { StepRideDates } from '../components/request/StepRideDates';
import { StepLocation } from '../components/request/StepLocation';
import { StepSite } from '../components/request/StepSite';
import { StepContact } from '../components/request/StepContact';
import { ReviewSummary } from '../components/request/ReviewSummary';
import { PlaceholderImage } from '../components/PlaceholderImage';
import { AvailabilityBadge } from '../components/AvailabilityBadge';
import { EstimateRange } from '../components/EstimateRange';
import { primaryButtonClass, secondaryButtonClass } from '../utils/formStyles';

const stepIntros = [
'Which ride, and when? You can change any of this later.',
'Where is the event, and roughly how many guests?',
'A few site details help operators judge fit. “Not sure” is always an option.',
'Who should we contact with questions and your quote?'];


export function EventRequest() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [submitting, setSubmitting] = useState(false);

  const initial = useMemo(() => {
    const location = params.get('location') ?? '';
    const [cityPart, statePart] = location.split(',').map((s) => s.trim());
    const stateMatch = usStates.find(
      (s) => s.code.toLowerCase() === statePart?.toLowerCase() || s.name.toLowerCase() === statePart?.toLowerCase()
    );
    return {
      rideSlug: params.get('ride') ?? '',
      startDate: params.get('date') ?? '',
      city: cityPart ?? '',
      state: stateMatch?.code ?? ''
    };
  }, [params]);

  const { form, step, errors, update, next, back, editStep, returnToReview } = useEventRequest(initial);
  const selectedRide = rides.find((r) => r.slug === form.rideSlug);
  const isReview = step === REVIEW_STEP;

  const handleSubmit = () => {
    setSubmitting(true);
    window.setTimeout(() => navigate('/request/received', { state: { form } }), 700);
  };

  const stepProps = { form, errors, update };

  return (
    <div className="mx-auto max-w-7xl px-6 pb-24 pt-10 lg:px-10">
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <h1 className="font-display text-4xl tracking-tight text-ink lg:text-5xl">Start an event request</h1>
          <p className="mt-3 text-ink-muted">
            We offer your event to the closest operator with this ride. If they can’t do it, we go to the next closest.
            Nothing is booked until an operator says yes and you approve the final price.
          </p>

          <div className="mt-8">
            <FormStepper current={step} />
          </div>

          <form
            className="mt-10"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (isReview) handleSubmit();else
              next();
            }}>
            
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}>
                
                <h2 className="font-display text-3xl text-ink">{isReview ? 'Review your request' : requestSteps[step]}</h2>
                <p className="mb-8 mt-2 text-ink-muted">
                  {isReview ? 'Check the details below. You can edit any section.' : stepIntros[step]}
                </p>

                {step === 0 && <StepRideDates {...stepProps} />}
                {step === 1 && <StepLocation {...stepProps} />}
                {step === 2 && <StepSite {...stepProps} />}
                {step === 3 && <StepContact {...stepProps} />}
                {isReview &&
                <>
                    <ReviewSummary form={form} onEdit={editStep} />
                    <div className="mt-6 rounded-xl border border-accent/40 bg-accent-soft px-5 py-4 text-sm leading-relaxed text-ink">
                      <p className="font-semibold">Submitting sends a request, not a booking.</p>
                      <p className="mt-1 text-ink-soft">
                        No ride is reserved and nothing is charged. You’ll receive an itemized quote once an operator’s
                        equipment is verified, and the booking is only confirmed after you accept it.
                      </p>
                    </div>
                  </>
                }
              </motion.div>
            </AnimatePresence>

            <div className="mt-10 flex items-center justify-between gap-4 border-t border-line pt-6">
              {step > 0 && !returnToReview ?
              <button type="button" onClick={back} className={secondaryButtonClass}>
                  <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" /> Back
                </button> :

              <span />
              }
              <button type="submit" disabled={submitting} className={primaryButtonClass}>
                {isReview ?
                submitting ?
                <>
                      <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden="true" /> Submitting…
                    </> :

                'Submit request' :

                returnToReview ?
                'Save and return to review' :

                <>
                    {step === 3 ? 'Review request' : 'Continue'} <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                  </>
                }
              </button>
            </div>
          </form>
        </div>

        <aside className="lg:col-span-4 lg:col-start-9" aria-label="Selected ride">
          <div className="sticky top-24 rounded-2xl border border-line bg-surface p-5">
            {selectedRide ?
            <>
                <PlaceholderImage className="aspect-[4/3] w-full rounded-xl" label={selectedRide.name} />
                <h2 className="mt-4 font-display text-2xl text-ink">{selectedRide.name}</h2>
                <AvailabilityBadge status={selectedRide.availability} className="mt-2" />
                <div className="mt-4 border-t border-line pt-4">
                  <EstimateRange low={selectedRide.estimateLow} high={selectedRide.estimateHigh} />
                </div>
              </> :

            <>
                <PlaceholderImage className="aspect-[4/3] w-full rounded-xl" compact label="No ride selected" />
                <h2 className="mt-4 font-display text-2xl text-ink">No ride selected yet</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Not sure what fits? Choose “Not sure yet” and we’ll recommend options for your site and audience.
                </p>
              </>
            }
            <ul className="mt-5 space-y-2 border-t border-line pt-4 text-sm text-ink-soft">
              <li>· Free to request</li>
              <li>· No unit reserved until you accept a quote</li>
              <li>· One team manages operator, payment and delivery</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>);

}