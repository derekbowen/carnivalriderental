import { format, parseISO } from 'date-fns';

export function formatEventDate(iso: string): string {
  if (!iso) return '';
  return format(parseISO(iso), 'EEE, MMM d, yyyy');
}

export function formatShortDate(iso: string): string {
  if (!iso) return '';
  return format(parseISO(iso), 'MMM d, yyyy');
}

export function formatDateRange(start: string, end?: string): string {
  if (!start) return '';
  if (!end || end === start) return formatEventDate(start);
  return `${format(parseISO(start), 'MMM d')} – ${format(parseISO(end), 'MMM d, yyyy')}`;
}

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}
