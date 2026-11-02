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

  React.useEffect(() => {
    if (ref.current) {
      ref.current.dataset.state = indeterminate ? 'indeterminate' : checked ? 'checked' : 'unchecked';
    }
  }, [checked, indeterminate]);

  return (
    <button
      ref={ref}
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      data-state={indeterminate ? 'indeterminate' : checked ? 'checked' : 'unchecked'}
      className={cn(
        'peer inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-border bg-background shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary',
        className,
      )}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    >
      {(checked || indeterminate) && (
        <Check className="size-3 text-primary-foreground" aria-hidden />
      )}
    </button>
  );
}

export { Checkbox };
