import type { EventRequestForm } from '../types/request';

export const requestSteps = ['Ride & dates', 'Location & venue', 'Site details', 'Contact & budget'];

export const emptyRequestForm: EventRequestForm = {
  rideSlug: '',
  startDate: '',
  endDate: '',
  dailyHours: '',
  datesFlexible: false,
  city: '',
  state: '',
  venueName: '',
  venueType: '',
  attendance: '',
  space: '',
  surface: '',
  power: '',
  access: '',
  siteNotes: '',
  name: '',
  organization: '',
  orgType: '',
  email: '',
  phone: '',
  budget: '',
  notes: ''
};

export const NOT_SURE_RIDE = 'not-sure';

export const dailyHoursOptions = ['Up to 4 hours', '4 – 8 hours', '8+ hours', 'Not sure'];

export const venueTypeOptions = [
'Open field or lawn',
'Parking lot or paved plaza',
'Closed street',
'Fairground or event site',
'Not sure'];


export const attendanceOptions = [
'Under 500 guests',
'500 – 2,000 guests',
'2,000 – 10,000 guests',
'10,000+ guests',
'Not sure'];


export const spaceOptions = ['Over 100 × 100 ft', '60 × 60 to 100 × 100 ft', 'Under 60 × 60 ft', 'Not sure'];

export const surfaceOptions = ['Level paved', 'Level grass or field', 'Uneven or sloped', 'Not sure'];

export const powerOptions = ['Mains power on site', 'Generator needed', 'Not sure'];

export const accessOptions = ['Open truck access (14 ft+)', 'Restricted access', 'Not sure'];

export const orgTypeOptions = ['Corporate', 'Municipality', 'School or college', 'Festival', 'Private event'];

export const budgetOptions = ['Under $5,000', '$5,000 – $15,000', '$15,000 – $40,000', '$40,000+', 'Not set yet'];