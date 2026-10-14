import type { EventRequestForm, FormErrors } from '../types/request';

export function validateRequestStep(step: number, form: EventRequestForm): FormErrors {
  const errors: FormErrors = {};
  if (step === 0) {
    if (!form.rideSlug) errors.rideSlug = 'Choose a ride, or select “Not sure yet”.';
    if (!form.startDate) errors.startDate = 'Add your event start date.';
    if (form.endDate && form.startDate && form.endDate < form.startDate) {
      errors.endDate = 'End date can’t be before the start date.';
    }
  }
  if (step === 1) {
    if (!form.city.trim()) errors.city = 'Add the event city.';
    if (!form.state) errors.state = 'Choose a state.';
    if (!form.venueType) errors.venueType = 'Choose a venue type, or “Not sure”.';
    if (!form.attendance) errors.attendance = 'Choose expected attendance, or “Not sure”.';
  }
  if (step === 2) {
    if (!form.space) errors.space = 'Choose an option — “Not sure” is fine.';
    if (!form.power) errors.power = 'Choose an option — “Not sure” is fine.';
    if (!form.access) errors.access = 'Choose an option — “Not sure” is fine.';
  }
  if (step === 3) {
    if (!form.name.trim()) errors.name = 'Add your name.';
    if (!form.orgType) errors.orgType = 'Choose the type of organization.';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errors.email = 'Enter a valid email address.';
    if (!form.budget) errors.budget = 'Choose a budget range, or “Not set yet”.';
  }
  return errors;
}