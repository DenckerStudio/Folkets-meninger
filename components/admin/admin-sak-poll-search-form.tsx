'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, FormEvent } from 'react';
import { Search } from 'lucide-react';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

type AdminSakPollSearchFormProps = {
  initialQuery?: string;
};

export function AdminSakPollSearchForm({ initialQuery = '' }: AdminSakPollSearchFormProps) {
  const router = useRouter();
  const inputId = useId();
  const [value, setValue] = useState(initialQuery);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    const href = trimmed ? `${routes.adminSak}?q=${encodeURIComponent(trimmed)}` : routes.adminSak;
    router.push(href);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <label htmlFor={inputId} className="sr-only">
        Søk saks-id eller tittel
      </label>
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          id={inputId}
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Saks-id eller del av tittel"
          autoComplete="off"
          className={cn(
            'min-h-11 w-full rounded-lg border border-border bg-background py-2 pl-10 pr-3 text-sm text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
          )}
        />
      </div>
      <button
        type="submit"
        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-foreground hover:bg-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        Søk
      </button>
    </form>
  );
}