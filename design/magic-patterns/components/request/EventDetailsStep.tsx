import React from 'react';
import { ChoiceGroup } from '../form/ChoiceGroup';
import { SelectField } from '../form/SelectField';
import { TextField } from '../form/TextField';
import { attendanceOptions, dateModeOptions } from '../../data/requestOptions';
import { eventTypes } from '../../data/eventTypes';
import { usStates } from '../../data/usStates';
import { todayISO } from '../../utils/date';
import type { StepProps } from '../../types/request';

export function EventDetailsStep({ draft, update, errors }: StepProps) {
  const isRange = draft.dateMode === 'range';
  return (
    <div className="space-y-8">
      <div>
        <ChoiceGroup
          name="dateMode"
          legend="Event date"
          options={dateModeOptions}
          value={draft.dateMode}
          onChange={(v) => update('dateMode', v === 'range' ? 'range' : 'single')}
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TextField
            id="dateStart"
            type="date"
            min={todayISO()}
            label={isRange ? 'Earliest date' : 'Date'}
            value={draft.dateStart}
            onChange={(e) => update('dateStart', e.target.value)}
            error={errors.dateStart}
          />
          {isRange && (
            <TextField
              id="dateEnd"
              type="date"
              min={draft.dateStart || todayISO()}
              label="Latest date"
              value={draft.dateEnd}
              onChange={(e) => update('dateEnd', e.target.value)}
              error={errors.dateEnd}
            />
          )}
        </div>
        <p className="mt-2 text-xs text-muted">Date ranges help — we can tell you which dates operators can cover.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <TextField
          id="city"
          label="City"
          autoComplete="address-level2"
          value={draft.city}
          onChange={(e) => update('city', e.target.value)}
          error={errors.city}
        />
        <SelectField id="state" label="State" value={draft.state} onChange={(e) => update('state', e.target.value)} error={errors.state}>
          <option value="">Select</option>
          {usStates.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </SelectField>
      </div>

      <TextField
        id="venue"
        label="Venue or site"
        optional
        placeholder="e.g. Riverside Civic Plaza"
        value={draft.venue}
        onChange={(e) => update('venue', e.target.value)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="hoursStart" type="time" label="Operating hours — start" optional value={draft.hoursStart} onChange={(e) => update('hoursStart', e.target.value)} />
        <TextField id="hoursEnd" type="time" label="Operating hours — end" optional value={draft.hoursEnd} onChange={(e) => update('hoursEnd', e.target.value)} />
      </div>

      <ChoiceGroup
        name="eventType"
        legend="Event type"
        options={eventTypes.map((t) => ({ value: t.value, label: t.label }))}
        value={draft.eventType}
        onChange={(v) => update('eventType', v)}
        error={errors.eventType}
        columns={3}
      />

      <ChoiceGroup
        name="attendance"
        legend="Expected attendance"
        options={attendanceOptions}
        value={draft.attendance}
        onChange={(v) => update('attendance', v)}
        error={errors.attendance}
        columns={4}
      />
    </div>
  );
}
