import React from 'react';
import type { EventRequestForm, FormErrors } from '../../types/request';
import { usStates } from '../../data/states';
import { attendanceOptions, venueTypeOptions } from '../../data/requestOptions';
import { inputClass } from '../../utils/formStyles';
import { Field } from './Field';
import { ChoiceGroup } from './ChoiceGroup';

interface StepProps {
  form: EventRequestForm;
  errors: FormErrors;
  update: <K extends keyof EventRequestForm>(field: K, value: EventRequestForm[K]) => void;
}

export function StepLocation({ form, errors, update }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <Field label="City" htmlFor="city" error={errors.city}>
          <input id="city" value={form.city} onChange={(e) => update('city', e.target.value)} className={inputClass} placeholder="e.g. Columbus" />
        </Field>
        <Field label="State" htmlFor="state" error={errors.state}>
          <select id="state" value={form.state} onChange={(e) => update('state', e.target.value)} className={inputClass}>
            <option value="">Choose…</option>
            {usStates.map((s) =>
            <option key={s.code} value={s.code}>
                {s.name}
              </option>
            )}
          </select>
        </Field>
      </div>

      <Field label="Venue name" htmlFor="venue" optional>
        <input id="venue" value={form.venueName} onChange={(e) => update('venueName', e.target.value)} className={inputClass} placeholder="e.g. Riverside Commons" />
      </Field>

      <ChoiceGroup
        legend="Venue type"
        name="venueType"
        options={venueTypeOptions}
        value={form.venueType}
        onChange={(v) => update('venueType', v)}
        error={errors.venueType} />
      

      <ChoiceGroup
        legend="Expected attendance"
        name="attendance"
        options={attendanceOptions}
        value={form.attendance}
        onChange={(v) => update('attendance', v)}
        error={errors.attendance} />
      
    </div>);

}