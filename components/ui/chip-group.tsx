'use client';

import { Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

export type ChipGroupOption = {
  value: string;
  label: string;
};

type ChipGroupProps = {
  options: readonly ChipGroupOption[];
  selected: readonly string[];
  onToggle: (value: string) => void;
  onClear?: () => void;
  /** Max chips before «+N mer» overflow. */
  maxVisible?: number;
  className?: string;
  ariaLabel?: string;
};

/**
 * Chip Group with +N more (21st.dev / kuratlielia, tilpasset tema).
 */
export function ChipGroup({
  options,
  selected,
  onToggle,
  onClear,
  maxVisible = 8,
  className,
  ariaLabel = 'Filter',
}: ChipGroupProps) {
  const [expanded, setExpanded] = useState(false);

  const visibleOptions = useMemo(() => {
    if (expanded || options.length <= maxVisible) return options;
    return options.slice(0, maxVisible);
  }, [expanded, maxVisible, options]);

  const hiddenCount = Math.max(0, options.length - maxVisible);

  return (
    <div
      className={cn(
        '-mx-1 flex snap-x snap-mandatory flex-wrap gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:overflow-x-visible [&::-webkit-scrollbar]:hidden',
        className,
      )}
      role="group"
      aria-label={ariaLabel}
    >
      {visibleOptions.map((option) => {
        const active = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onToggle(option.value)}
            aria-pressed={active}
            className={cn(
              'inline-flex min-h-11 shrink-0 snap-start items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors',
              active
                ? 'border-brand bg-brand text-brand-foreground'
                : 'border-border bg-card text-foreground hover:border-muted-foreground/40',
            )}
          >
            {active ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
            {option.label}
          </button>
        );
      })}
      {!expanded && hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="inline-flex min-h-11 shrink-0 snap-start items-center rounded-full border border-dashed border-border bg-muted/30 px-3.5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          +{hiddenCount} mer
        </button>
      ) : null}
      {selected.length > 0 && onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex min-h-11 shrink-0 snap-start items-center rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Nullstill emner
        </button>
      ) : null}
    </div>
  );
}
