import { useState } from 'react';
import type { EventRequestForm, FormErrors } from '../types/request';
import { emptyRequestForm } from '../data/requestOptions';
import { validateRequestStep } from '../utils/requestValidation';

export const REVIEW_STEP = 4;

export function useEventRequest(initial: Partial<EventRequestForm>) {
  const [form, setForm] = useState<EventRequestForm>({ ...emptyRequestForm, ...initial });
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<FormErrors>({});
  const [returnToReview, setReturnToReview] = useState(false);

  const update = <K extends keyof EventRequestForm,>(field: K, value: EventRequestForm[K]) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => {
      if (!e[field]) return e;
      const next = { ...e };
      delete next[field];
      return next;
    });
  };

  const next = () => {
    const errs = validateRequestStep(step, form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return false;
    }
    setErrors({});
    setStep(returnToReview ? REVIEW_STEP : step + 1);
    setReturnToReview(false);
    return true;
  };

  const back = () => {
    setErrors({});
    setStep((s) => Math.max(0, s - 1));
  };

  const editStep = (target: number) => {
    setReturnToReview(true);
    setStep(target);
  };

  return { form, step, errors, update, next, back, editStep, returnToReview };
}