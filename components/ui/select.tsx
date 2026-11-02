'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

type SelectProps = React.ComponentProps<'select'> & {
  /** Classes for the outer positioning wrapper (width, margins). Defaults to `w-full`. */
  wrapperClassName?: string;
};

function Select({ className, wrapperClassName, ...props }: SelectProps) {
  return (
    <div className={cn('relative min-w-0', wrapperClassName ?? 'w-full')}>
      <select
        data-slot="select"
        className={cn(
          'flex min-h-11 w-full min-w-0 appearance-none rounded-lg border border-border bg-background py-2 pr-9 pl-3 text-sm text-foreground shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30',
          className,
        )}
        {...props}
      />
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}

export { Select };
