import React from 'react';
import type { EventRequestForm, FormErrors } from '../../types/request';
import { rides } from '../../data/rides';
import { dailyHoursOptions, NOT_SURE_RIDE } from '../../data/requestOptions';
import { inputClass } from '../../utils/formStyles';
import { Field } from './Field';
import { ChoiceGroup } from './ChoiceGroup';

interface StepProps {
  form: EventRequestForm;
  errors: FormErrors;
  update: <K extends keyof EventRequestForm>(field: K, value: EventRequestForm[K]) => void;
}

export function StepRideDates({ form, errors, update }: StepProps) {
  return (
    <div className="space-y-6">
      <Field label="Ride" htmlFor="ride" error={errors.rideSlug}>
        <select id="ride" value={form.rideSlug} onChange={(e) => update('rideSlug', e.target.value)} className={inputClass}>
          <option value="">Choose a ride…</option>
          {rides.map((r) =>
          <option key={r.slug} value={r.slug}>
              {r.name}
            </option>
          )}
          <option value={NOT_SURE_RIDE}>Not sure yet — recommend a ride for my event</option>
        </select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Event start date" htmlFor="start" error={errors.startDate}>
          <input id="start" type="date" value={form.startDate} onChange={(e) => update('startDate', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Event end date" htmlFor="end" optional error={errors.endDate}>
          <input id="end" type="date" value={form.endDate} onChange={(e) => update('endDate', e.target.value)} className={inputClass} />
        </Field>
      </div>

      <label className="flex items-center gap-2.5 text-[15px] text-ink">
        <input
          type="checkbox"
          checked={form.datesFlexible}
          onChange={(e) => update('datesFlexible', e.target.checked)}
          className="h-4 w-4 accent-ink" />
        
        My dates are flexible by a week or two
      </label>

      <ChoiceGroup
        legend="Operating hours per day"
        name="hours"
        options={dailyHoursOptions}
        value={form.dailyHours}
        onChange={(v) => update('dailyHours', v)} />
      
    </div>);

}