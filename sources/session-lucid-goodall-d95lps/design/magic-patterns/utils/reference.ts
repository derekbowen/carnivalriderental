import { brand } from '../data/brand';

export function generateReference(): string {
  const n = Math.floor(25000 + Math.random() * 74999);
  return `${brand.referencePrefix}-${n}`;
}
