import React from 'react';
import { cn } from '@/lib/utils';

/** Stacked label + value for read-only detail blocks (e.g. view modals). */
export function DetailRow({ label, children, className }) {
  return (
    <div className={cn(className)}>
      <p className="text-sm font-medium text-gray-700 mb-1">{label}</p>
      <div className="text-sm text-gray-900 break-words">{children}</div>
    </div>
  );
}
