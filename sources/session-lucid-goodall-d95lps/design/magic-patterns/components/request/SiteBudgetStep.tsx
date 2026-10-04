import React from 'react';
import { ChoiceGroup } from '../form/ChoiceGroup';
import { TextAreaField } from '../form/TextAreaField';
import { accessOptions, budgetOptions, powerOptions, spaceOptions } from '../../data/requestOptions';
import type { StepProps } from '../../types/request';

export function SiteBudgetStep({ draft, update, errors }: StepProps) {
  return (
    <div className="space-y-8">
      <p className="rounded-lg bg-sand/60 px-4 py-3 text-sm text-ink/80">
        Best guesses are fine. Choose <strong>Not sure</strong> for anything you don't know yet — we'll confirm details
        with you and the operator during sourcing.
      </p>
      <ChoiceGroup name="access" legend="Site access" options={accessOptions} value={draft.access} onChange={(v) => update('access', v)} error={errors.access} columns={2} />
      <ChoiceGroup name="space" legend="Available space for the ride" options={spaceOptions} value={draft.space} onChange={(v) => update('space', v)} error={errors.space} columns={3} />
      <ChoiceGroup name="power" legend="Power" options={powerOptions} value={draft.power} onChange={(v) => update('power', v)} error={errors.power} columns={2} />
      <ChoiceGroup
        name="budget"
        legend="Budget"
        hint="Total for rides, crew, transport and setup."
        options={budgetOptions}
        value={draft.budget}
        onChange={(v) => update('budget', v)}
        error={errors.budget}
        columns={3}
      />
      <TextAreaField
        id="siteNotes"
        label="Site notes"
        optional
        placeholder="e.g. Gate clearance, ground conditions, load-in times"
        value={draft.siteNotes}
        onChange={(e) => update('siteNotes', e.target.value)}
      />
    </div>
  );
}
