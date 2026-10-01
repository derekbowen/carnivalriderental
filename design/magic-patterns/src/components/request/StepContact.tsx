import React from 'react';
import type { EventRequestForm, FormErrors } from '../../types/request';
import { budgetOptions, orgTypeOptions } from '../../data/requestOptions';
import { inputClass } from '../../utils/formStyles';
import { Field } from './Field';
import { ChoiceGroup } from './ChoiceGroup';

interface StepProps {
  form: EventRequestForm;
  errors: FormErrors;
  update: <K extends keyof EventRequestForm>(field: K, value: EventRequestForm[K]) => void;
}

export function StepContact({ form, errors, update }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="name" error={errors.name}>
          <input id="name" autoComplete="name" value={form.name} onChange={(e) => update('name', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Organization" htmlFor="org" optional>
          <input id="org" autoComplete="organization" value={form.organization} onChange={(e) => update('organization', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email}>
          <input id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => update('email', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Phone" htmlFor="phone" optional>
          <input id="phone" type="tel" autoComplete="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} className={inputClass} />
        </Field>
      </div>

      <ChoiceGroup
        legend="Type of organization"
        name="orgType"
        options={orgTypeOptions}
        value={form.orgType}
        onChange={(v) => update('orgType', v)}
        error={errors.orgType}
        columns={3} />
      

      <ChoiceGroup
        legend="Budget for this ride"
        name="budget"
        hint="Helps us source the right unit. It doesn’t set your price."
        options={budgetOptions}
        value={form.budget}
        onChange={(v) => update('budget', v)}
        error={errors.budget}
        columns={3} />
      

      <Field label="Notes for our team" htmlFor="notes" optional>
        <textarea id="notes" rows={3} value={form.notes} onChange={(e) => update('notes', e.target.value)} className={inputClass} />
      </Field>
    </div>);

}