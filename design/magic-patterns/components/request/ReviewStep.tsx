import React from 'react';
import { InfoIcon, PencilIcon } from 'lucide-react';
import { summarizeDraft } from '../../utils/draftSummary';
import type { EventRequestDraft, FieldErrors } from '../../types/request';

type Props = {
  draft: EventRequestDraft;
  errors: FieldErrors;
  acknowledged: boolean;
  onAcknowledge: (value: boolean) => void;
  onEdit: (step: number) => void;
};

export function ReviewStep({ draft, errors, acknowledged, onAcknowledge, onEdit }: Props) {
  const sections = summarizeDraft(draft);
  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <section key={section.title} className="rounded-xl border border-line" aria-labelledby={`review-${section.step}`}>
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h3 id={`review-${section.step}`} className="font-display text-lg">{section.title}</h3>
            <button
              type="button"
              onClick={() => onEdit(section.step)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gold-deep hover:underline"
            >
              <PencilIcon size={13} aria-hidden="true" /> Edit<span className="sr-only"> {section.title}</span>
            </button>
          </div>
          <dl className="divide-y divide-line">
            {section.rows.map((row) => (
              <div key={row.label} className="grid gap-1 px-5 py-3 sm:grid-cols-[180px_1fr] sm:gap-4">
                <dt className="text-sm text-muted">{row.label}</dt>
                <dd className="text-sm text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <div className="flex gap-3 rounded-xl bg-midnight p-5 text-ivory">
        <InfoIcon size={18} className="mt-0.5 shrink-0 text-gold" aria-hidden="true" />
        <div className="text-sm leading-relaxed text-ivory/80">
          <p className="font-semibold text-ivory">What submitting does</p>
          <p className="mt-1">
            We'll start sourcing operators for your event and send a written quote. No ride is reserved, no payment is
            taken, and nothing is booked until you accept the final scope and an operator commits to your date.
          </p>
        </div>
      </div>

      <div>
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded accent-midnight"
            checked={acknowledged}
            onChange={(e) => onAcknowledge(e.target.checked)}
            aria-describedby={errors.acknowledged ? 'ack-error' : undefined}
          />
          <span>I understand this is a request for a quote, not a booking, and that ride availability is confirmed only after an operator commits.</span>
        </label>
        {errors.acknowledged && (
          <p id="ack-error" role="alert" className="ml-7 mt-1.5 text-sm text-red-700">{errors.acknowledged}</p>
        )}
      </div>
    </div>
  );
}
