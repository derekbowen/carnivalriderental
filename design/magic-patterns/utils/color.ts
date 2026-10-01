/** Converts "#RRGGBB" to "R G B" channels for Tailwind alpha-aware CSS variables. */
export function hexToChannels(hex: string): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((ch) => ch + ch).join('') : clean;
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}
