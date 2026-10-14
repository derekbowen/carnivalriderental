import React from 'react';
import { CalendarClockIcon, ShieldCheckIcon } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import type { AvailabilityStatus } from '../types/ride';

interface AvailabilityBadgeProps {
  status: AvailabilityStatus;
  className?: string;
}

export function AvailabilityBadge({ status, className }: AvailabilityBadgeProps) {
  if (status === 'verified') {
    return (
      <span
        className={twMerge(
          'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success',
          className
        )}>
        
        <ShieldCheckIcon className="h-3.5 w-3.5" aria-hidden="true" />
        Operator confirmed
      </span>);

  }
  return (
    <span
      className={twMerge(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-ink',
        className
      )}>
      
      <CalendarClockIcon className="h-3.5 w-3.5" aria-hidden="true" />
      Date confirmed at booking
    </span>);

}