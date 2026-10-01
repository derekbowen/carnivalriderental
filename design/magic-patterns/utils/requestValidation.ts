import type { EventRequestDraft, FieldErrors } from '../types/request';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateStep(step: number, d: EventRequestDraft): FieldErrors {
  const e: FieldErrors = {};
  if (step === 0) {
    if (!d.flexibility) e.flexibility = 'Choose how flexible you are on the ride.';
  }
  if (step === 1) {
    if (!d.dateStart) e.dateStart = d.dateMode === 'range' ? 'Add the earliest date.' : 'Add your event date.';
    if (d.dateMode === 'range') {
      if (!d.dateEnd) e.dateEnd = 'Add the latest date.';
      else if (d.dateStart && d.dateEnd < d.dateStart) e.dateEnd = 'Latest date must be after the earliest date.';
    }
    if (!d.city.trim()) e.city = 'Add the event city.';
    if (!d.state) e.state = 'Choose a state.';
    if (!d.eventType) e.eventType = 'Choose an event type.';
    if (!d.attendance) e.attendance = 'Choose expected attendance.';
  }
  if (step === 2) {
    if (!d.access) e.access = 'Choose an option — "Not sure" is fine.';
    if (!d.space) e.space = 'Choose an option — "Not sure" is fine.';
    if (!d.power) e.power = 'Choose an option — "Not sure" is fine.';
    if (!d.budget) e.budget = 'Choose a budget range — "Not sure yet" is fine.';
  }
  if (step === 3) {
    if (!d.name.trim()) e.name = 'Add your name.';
    if (!d.organization.trim()) e.organization = 'Add your organization.';
    if (!emailPattern.test(d.email)) e.email = 'Add a valid email address.';
  }
  return e;
}
