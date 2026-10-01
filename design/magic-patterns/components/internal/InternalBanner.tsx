import React from 'react';
import { LockIcon } from 'lucide-react';

export function InternalBanner() {
  return (
    <div className="border-b border-amber-300 bg-amber-100 text-amber-950">
      <div className="mx-auto flex max-w-7xl items-center gap-2.5 px-5 py-2 text-xs sm:px-8">
        <LockIcon size={13} aria-hidden="true" />
        <span className="font-bold uppercase tracking-[0.16em]">Internal</span>
        <span className="text-amber-900/80">Staff only — supplier names, costs and contribution are never shown to customers.</span>
      </div>
    </div>
  );
}
