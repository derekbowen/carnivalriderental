import { useCallback, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSubmittedRequests } from '../contexts/SubmittedRequestsContext';
import { rides } from '../data/rides';
import { usStates } from '../data/usStates';
import { eventTypes } from '../data/eventTypes';
import { generateReference } from '../utils/reference';
import { validateStep } from '../utils/requestValidation';
import type { EventRequestDraft, FieldErrors, UpdateDraft } from '../types/request';

export const requestSteps = ['Ride & flexibility', 'Event details', 'Site & budget', 'Contact', 'Review'];
export const REVIEW_STEP = 4;

function initialDraft(params: URLSearchParams): EventRequestDraft {
  const rideParam = params.get('ride') ?? '';
  const location = params.get('location') ?? '';
  const [cityPart, statePart] = location.split(',').map((s) => s.trim());
  const stateCandidate = (params.get('state') ?? statePart ?? '').toUpperCase();
  const eventTypeParam = params.get('eventType') ?? '';

  return {
    rideSlug: rides.some((r) => r.slug === rideParam) ? rideParam : '',
    flexibility: 'similar',
    rideNotes: '',
    dateMode: 'single',
    dateStart: params.get('date') ?? '',
    dateEnd: '',
    city: params.get('city') ?? cityPart ?? '',
    state: usStates.some((s) => s.value === stateCandidate) ? stateCandidate : '',
    venue: '',
    hoursStart: '',
    hoursEnd: '',
    eventType: eventTypes.some((t) => t.value === eventTypeParam) ? eventTypeParam : '',
    attendance: '',
    access: '',
    space: '',
    power: '',
    budget: '',
    siteNotes: '',
    name: '',
    organization: '',
    role: '',
    email: '',
    phone: '',
    contactPreference: 'email',
  };
}

export function useEventRequest() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { addSubmitted } = useSubmittedRequests();

  const [draft, setDraft] = useState<EventRequestDraft>(() => initialDraft(params));
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const update: UpdateDraft = useCallback((key, value) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  }, []);

  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const next = () => {
    const stepErrors = validateStep(step, draft);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) return;
    const target = step + 1;
    setStep(target);
    setFurthest((f) => Math.max(f, target));
    scrollTop();
  };

  const back = () => {
    setErrors({});
    setStep((s) => Math.max(0, s - 1));
    scrollTop();
  };

  const goTo = (target: number) => {
    if (target > furthest) return;
    setErrors({});
    setStep(target);
    scrollTop();
  };

  const toggleAcknowledged = (value: boolean) => {
    setAcknowledged(value);
    if (value) setErrors((e) => ({ ...e, acknowledged: undefined }));
  };

  const submit = () => {
    if (!acknowledged) {
      setErrors({ acknowledged: 'Please confirm you understand this is a request, not a booking.' });
      return;
    }
    setSubmitting(true);
    window.setTimeout(() => {
      const reference = generateReference();
      addSubmitted({ reference, submittedAt: new Date().toISOString(), draft });
      navigate(`/request/submitted/${reference}`);
    }, 900);
  };

  return { draft, update, step, furthest, errors, next, back, goTo, submit, submitting, acknowledged, toggleAcknowledged };
}
