import type { Option } from '../types/request';

export function optionLabel(options: Option[], value: string, fallback = 'Not provided'): string {
  return options.find((o) => o.value === value)?.label ?? fallback;
}

export function formatTime(value: string): string {
  if (!value) return '';
  const [h, m] = value.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function formatHours(start: string, end: string): string {
  if (!start && !end) return 'Not provided';
  return `${formatTime(start) || '—'} – ${formatTime(end) || '—'}`;
}
