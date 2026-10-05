'use client';

import { LayoutGroup } from 'motion/react';
import { TabUnderline } from '@/components/motion/tab-underline';
import { cn } from '@/lib/utils';

type TabItem<T extends string> = {
  id: T;
  label: string;
};

export function SectionTabs<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <LayoutGroup>
    <div className="flex flex-wrap gap-2" role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          onClick={() => onChange(item.id)}
          className={cn(
            'relative rounded-lg px-3 py-1.5 text-sm font-medium',
            value === item.id
              ? 'bg-brand/10 text-brand'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          {item.label}
          {value === item.id ? <TabUnderline layoutId="section-tabs" /> : null}
        </button>
      ))}
    </div>
    </LayoutGroup>
  );
}
