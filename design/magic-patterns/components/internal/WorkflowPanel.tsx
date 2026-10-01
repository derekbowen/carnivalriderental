import React, { useState } from 'react';
import { Select } from '../Select';
import { Input } from '../Input';
import { Button } from '../Button';
import { internalStatuses } from '../../data/statusStages';
import type { InternalStatus } from '../../types/request';

type Props = {
  status: InternalStatus;
  nextAction: string;
  coordinator: string;
  onStatusChange: (status: InternalStatus) => void;
  onNextActionChange: (value: string) => void;
};

export function WorkflowPanel({ status, nextAction, coordinator, onStatusChange, onNextActionChange }: Props) {
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const save = () => {
    setSaveState('saving');
    window.setTimeout(() => {
      setSaveState('saved');
      window.setTimeout(() => setSaveState('idle'), 2000);
    }, 600);
  };

  return (
    <section aria-labelledby="workflow-heading" className="rounded-xl border border-line bg-white p-5">
      <h2 id="workflow-heading" className="font-display text-lg">Workflow</h2>
      <p className="mt-0.5 text-xs text-muted">Coordinator: {coordinator}</p>
      <div className="mt-5 space-y-4">
        <Select
          label="Status"
          value={status}
          options={internalStatuses.map((s) => ({ value: s, label: s }))}
          onChange={(v) => {
            onStatusChange(v as InternalStatus);
            setSaveState('idle');
          }}
        />
        <Input
          id="next-action"
          label="Next action"
          value={nextAction}
          onChange={(e) => {
            onNextActionChange(e.target.value);
            setSaveState('idle');
          }}
          helperText="Shown in the queue for the whole team."
        />
        <div className="flex items-center gap-3">
          <Button size="small" loading={saveState === 'saving'} onClick={save}>
            Save changes
          </Button>
          <span className="text-xs text-emerald-700" aria-live="polite">{saveState === 'saved' ? 'Saved' : ''}</span>
        </div>
      </div>
    </section>
  );
}
