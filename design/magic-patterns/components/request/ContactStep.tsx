import React from 'react';
import { ChoiceGroup } from '../form/ChoiceGroup';
import { TextField } from '../form/TextField';
import { contactPreferenceOptions } from '../../data/requestOptions';
import type { StepProps } from '../../types/request';

export function ContactStep({ draft, update, errors }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="name" label="Full name" autoComplete="name" value={draft.name} onChange={(e) => update('name', e.target.value)} error={errors.name} />
        <TextField id="role" label="Role or title" optional autoComplete="organization-title" value={draft.role} onChange={(e) => update('role', e.target.value)} />
      </div>
      <TextField
        id="organization"
        label="Organization"
        autoComplete="organization"
        placeholder="Company, city department, school or festival"
        value={draft.organization}
        onChange={(e) => update('organization', e.target.value)}
        error={errors.organization}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="email" type="email" label="Work email" autoComplete="email" value={draft.email} onChange={(e) => update('email', e.target.value)} error={errors.email} />
        <TextField id="phone" type="tel" label="Phone" optional autoComplete="tel" value={draft.phone} onChange={(e) => update('phone', e.target.value)} />
      </div>
      <ChoiceGroup
        name="contactPreference"
        legend="How should we reach you?"
        options={contactPreferenceOptions}
        value={draft.contactPreference}
        onChange={(v) => update('contactPreference', v)}
      />
    </div>
  );
}
