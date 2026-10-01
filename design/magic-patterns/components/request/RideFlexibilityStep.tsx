import React from 'react';
import { ChoiceGroup } from '../form/ChoiceGroup';
import { SelectField } from '../form/SelectField';
import { TextAreaField } from '../form/TextAreaField';
import { PlaceholderImage } from '../PlaceholderImage';
import { PriceKindLabel } from '../PriceKindLabel';
import { SourcingChip } from '../SourcingChip';
import { categories } from '../../data/categories';
import { rides } from '../../data/rides';
import { flexibilityOptions } from '../../data/requestOptions';
import { formatRange } from '../../utils/currency';
import type { StepProps } from '../../types/request';

export function RideFlexibilityStep({ draft, update, errors }: StepProps) {
  const ride = rides.find((r) => r.slug === draft.rideSlug);

  return (
    <div className="space-y-8">
      <SelectField
        id="ride"
        label="Which ride are you interested in?"
        value={draft.rideSlug}
        onChange={(e) => update('rideSlug', e.target.value)}
        hint="Not sure yet? Choose “Help me choose” and describe your goals below."
      >
        <option value="">Help me choose</option>
        {categories.map((c) => (
          <optgroup key={c.id} label={c.name}>
            {rides
              .filter((r) => r.categoryId === c.id)
              .map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.name}
                </option>
              ))}
          </optgroup>
        ))}
      </SelectField>

      {ride && (
        <div className="flex gap-4 rounded-xl border border-line bg-ivory p-3">
          <PlaceholderImage glyph={ride.glyph} size="sm" className="h-24 w-32 shrink-0 rounded-lg" />
          <div className="min-w-0 py-1">
            <p className="font-display text-lg leading-tight">{ride.name}</p>
            <p className="mt-1 text-sm">Estimate from {formatRange(ride.estimateMin, ride.estimateMax)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <PriceKindLabel kind="estimate" />
              <SourcingChip className="!py-0.5" />
            </div>
          </div>
        </div>
      )}

      <ChoiceGroup
        name="flexibility"
        legend="How flexible are you on the ride?"
        hint="More flexibility usually means more operators we can source from."
        options={flexibilityOptions}
        value={draft.flexibility}
        onChange={(v) => update('flexibility', v)}
        error={errors.flexibility}
        columns={3}
      />

      <TextAreaField
        id="rideNotes"
        label="Anything we should know about the ride?"
        optional
        placeholder="e.g. Needs to be visible from the main stage, or we'd like lighting for an evening event"
        value={draft.rideNotes}
        onChange={(e) => update('rideNotes', e.target.value)}
      />
    </div>
  );
}
