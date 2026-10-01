import React from 'react';
import { brand } from '../../data/brand';
import { hexToChannels } from '../../utils/color';

export function BrandTheme({ children }: { children: React.ReactNode }) {
  const vars = Object.fromEntries(
    Object.entries(brand.colors).map(([key, hex]) => [`--c-${key}`, hexToChannels(hex)]),
  ) as React.CSSProperties;

  return (
    <div style={vars} className="min-h-screen w-full bg-ivory font-sans text-ink antialiased">
      {children}
    </div>
  );
}
