'use client';

import type { ComponentPropsWithoutRef, KeyboardEventHandler } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

type ReuiComboboxTriggerProps = ComponentPropsWithoutRef<'button'> & {
  label: string;
  placeholder?: string;
  value: string;
};

/** Kompakt combobox-trigger (ReUI / sean0205, tilpasset sakvelger). */
export function ReuiComboboxTrigger({
  label,
  placeholder = 'Velg…',
  value,
  className,
  type = 'button',
  ...props
}: ReuiComboboxTriggerProps) {
  const display = value.trim() || placeholder;
  return (
    <button
      type={type}
      className={cn(
        'flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 text-left text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/40',
        className,
      )}
      {...props}
    >
      <span className="inline-flex min-w-0 items-center gap-2">
        <Search className="h-4 w-4 shrink-0 text-brand" aria-hidden />
        <span className="truncate">{display}</span>
      </span>
      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="sr-only">{label}</span>
    </button>
  );
}

type ReuiComboboxSearchProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  listId: string;
  activeDescendant?: string;
  placeholder?: string;
};

export function ReuiComboboxSearch({
  id,
  value,
  onChange,
  onKeyDown,
  listId,
  activeDescendant,
  placeholder,
}: ReuiComboboxSearchProps) {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        id={id}
        type="search"
        role="combobox"
        aria-expanded
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeDescendant}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-brand/30"
        autoComplete="off"
      />
    </div>
  );
}
