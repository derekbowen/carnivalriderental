import React from 'react';
import type { EventRequestForm, FormErrors } from '../../types/request';
import { accessOptions, powerOptions, spaceOptions, surfaceOptions } from '../../data/requestOptions';
import { inputClass } from '../../utils/formStyles';
import { Field } from './Field';
import { ChoiceGroup } from './ChoiceGroup';

interface StepProps {
  form: EventRequestForm;
  errors: FormErrors;
  update: <K extends keyof EventRequestForm>(field: K, value: EventRequestForm[K]) => void;
}

export function StepSite({ form, errors, update }: StepProps) {
  return (
    <div className="space-y-6">
      <p className="rounded-lg bg-canvas px-4 py-3 text-sm leading-relaxed text-ink-soft">
        Rough answers are fine. If you choose “Not sure”, we’ll confirm the detail with you and the operator before
        quoting — it won’t delay your request.
      </p>

      <ChoiceGroup
        legend="Available space for the ride"
        name="space"
        options={spaceOptions}
        value={form.space}
        onChange={(v) => update('space', v)}
        error={errors.space} />
      
      <ChoiceGroup
        legend="Ground surface"
        name="surface"
        options={surfaceOptions}
        value={form.surface}
        onChange={(v) => update('surface', v)} />
      
      <ChoiceGroup
        legend="Power"
        name="power"
        options={powerOptions}
        value={form.power}
        onChange={(v) => update('power', v)}
        error={errors.power}
        columns={3} />
      
      <ChoiceGroup
        legend="Truck access to the site"
        name="access"
        hint="Larger rides arrive on full-size trailers."
        options={accessOptions}
        value={form.access}
        onChange={(v) => update('access', v)}
        error={errors.access}
        columns={3} />
      

      <Field label="Anything else about the site?" htmlFor="siteNotes" optional>
        <textarea
          id="siteNotes"
          rows={3}
          value={form.siteNotes}
          onChange={(e) => update('siteNotes', e.target.value)}
          className={inputClass}
          placeholder="Overhead lines, trees, slopes, curfew times…" />
        
      </Field>
    </div>);

}