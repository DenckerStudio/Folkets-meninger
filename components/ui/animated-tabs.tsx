'use client';

import { useId } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

export type AnimatedTab = {
  id: string;
  label: string;
};

type AnimatedTabsProps = {
  tabs: readonly AnimatedTab[];
  activeId: string;
  onSelect: (id: string) => void;
  ariaLabel?: string;
  idPrefix?: string;
  layoutId?: string;
  className?: string;
  tabClassName?: string;
};

/**
 * Animated Tabs (21st.dev / kuratlielia, tilpasset tema).
 * Trykkflater er minst 44px, og indikatoren glir mellom fanene.
 */
export function AnimatedTabs({
  tabs,
  activeId,
  onSelect,
  ariaLabel,
  idPrefix = 'tab',
  layoutId,
  className,
  tabClassName,
}: AnimatedTabsProps) {
  const generatedId = useId();
  const indicatorId = layoutId ?? `animated-tabs-${generatedId}`;

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'flex gap-1 rounded-2xl border border-border bg-muted/40 p-1',
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${idPrefix}-${tab.id}`}
            aria-selected={active}
            onClick={() => onSelect(tab.id)}
            className={cn(
              'relative inline-flex min-h-11 flex-1 items-center justify-center whitespace-nowrap rounded-xl px-3 text-sm font-medium transition-colors',
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              tabClassName,
            )}
          >
            {active ? (
              <motion.span
                layoutId={indicatorId}
                className="absolute inset-0 rounded-xl bg-card shadow-sm"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                aria-hidden
              />
            ) : null}
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
