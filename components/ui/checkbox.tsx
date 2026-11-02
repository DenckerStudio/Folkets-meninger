'use client';

import * as React from 'react';
import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

type CheckboxProps = Omit<React.ComponentProps<'button'>, 'onChange'> & {
  checked?: boolean;
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

function Checkbox({
  className,
  checked = false,
  indeterminate = false,
  onCheckedChange,
  ...props
}: CheckboxProps) {
  const ref = React.useRef<HTMLButtonElement>(null);
  const state = indeterminate ? 'indeterminate' : checked ? 'checked' : 'unchecked';

  React.useEffect(() => {
    if (ref.current) {
      ref.current.dataset.state = state;
    }
  }, [state]);

  return (
    <button
      ref={ref}
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      data-state={state}
      className={cn(
        'group/checkbox inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-transparent p-0 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 max-sm:size-11',
        className,
      )}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'inline-flex size-4 items-center justify-center rounded-[4px] border border-border bg-background shadow-xs transition-colors',
          'group-data-[state=checked]/checkbox:border-primary group-data-[state=checked]/checkbox:bg-primary',
          'group-data-[state=indeterminate]/checkbox:border-primary group-data-[state=indeterminate]/checkbox:bg-primary',
        )}
      >
        {(checked || indeterminate) && (
          <Check className="size-3 text-primary-foreground" aria-hidden />
        )}
      </span>
    </button>
  );
}

export { Checkbox };
