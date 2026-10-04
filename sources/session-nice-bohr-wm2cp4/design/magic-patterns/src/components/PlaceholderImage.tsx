import React from 'react';
import { ImageIcon } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface PlaceholderImageProps {
  className?: string;
  label?: string;
  compact?: boolean;
}

export function PlaceholderImage({ className, label, compact = false }: PlaceholderImageProps) {
  return (
    <div
      role="img"
      aria-label={`Development placeholder image${label ? `: ${label}` : ''}`}
      className={twMerge(
        'relative flex items-center justify-center overflow-hidden bg-placeholder text-ink-soft',
        className
      )}>
      
      <div className="flex flex-col items-center gap-1.5 px-4 text-center">
        <ImageIcon className={compact ? 'h-4 w-4 opacity-60' : 'h-6 w-6 opacity-60'} aria-hidden="true" />
        {!compact &&
        <>
            <span className="text-[11px] font-medium uppercase tracking-[0.12em]">
              Development placeholder image
            </span>
            {label && <span className="text-xs text-ink-soft/80">{label}</span>}
          </>
        }
      </div>
    </div>);

}