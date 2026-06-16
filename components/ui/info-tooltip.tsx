'use client';

import { useId, useState } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

type InfoTooltipProps = {
  label: string;
  description: string;
  className?: string;
  side?: 'top' | 'bottom';
};

export function InfoTooltip({ label, description, className, side = 'top' }: InfoTooltipProps) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);

  return (
    <span className={cn('relative inline-flex items-center', className)}>
      <button
        type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Hva betyr ${label}?`}
        aria-describedby={open ? tooltipId : undefined}
        onClick={() => setOpen((prev) => !prev)}
        onBlur={() => setOpen(false)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 w-64 rounded-lg border border-border bg-popover px-3 py-2 text-xs leading-relaxed text-popover-foreground shadow-lg transition-opacity',
          side === 'top' ? 'bottom-full left-1/2 mb-2 -translate-x-1/2' : 'top-full left-1/2 mt-2 -translate-x-1/2',
          open ? 'opacity-100' : 'opacity-0',
        )}
      >
        {description}
      </span>
    </span>
  );
}

type LabeledWithTooltipProps = {
  label: string;
  tooltip?: string | null;
  showTooltip: boolean;
  children: React.ReactNode;
  className?: string;
};

export function LabeledWithTooltip({
  label,
  tooltip,
  showTooltip,
  children,
  className,
}: LabeledWithTooltipProps) {
  return (
    <div className={className}>
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        {showTooltip && tooltip ? <InfoTooltip label={label} description={tooltip} /> : null}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
