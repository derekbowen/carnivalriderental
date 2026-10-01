export function fieldClass(hasError: boolean): string {
  return [
    'block w-full rounded-md border bg-white px-3.5 py-2.5 text-[15px] text-ink placeholder:text-muted/70',
    'focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-1',
    hasError ? 'border-red-600' : 'border-line hover:border-muted/60',
  ].join(' ');
}
