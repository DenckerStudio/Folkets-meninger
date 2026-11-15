import Link from 'next/link';
import type { SporsmalType } from '@/lib/stortinget';
import { sporsmalTypeLabel } from '@/lib/stortinget-sporsmal';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

type SporsmalTypeTabsProps = {
  activeType: SporsmalType;
  sesjonId: string;
  className?: string;
};

export function SporsmalTypeTabs({ activeType, sesjonId, className }: SporsmalTypeTabsProps) {
  const typeHref = (nextType: SporsmalType) => {
    const params = new URLSearchParams({ type: nextType, sesjonId });
    return `${routes.sporsmal}?${params.toString()}`;
  };

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {(['skriftligesporsmal', 'sporretimesporsmal', 'interpellasjoner'] as SporsmalType[]).map((t) => {
        const selected = t === activeType;
        return (
          <Link
            key={t}
            href={typeHref(t)}
            aria-current={selected ? 'page' : undefined}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-semibold border transition-colors min-h-11 inline-flex items-center',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
              selected
                ? 'bg-muted text-brand border-border'
                : 'bg-card text-muted-foreground border-border hover:bg-muted/50',
            )}
          >
            {sporsmalTypeLabel(t)}
          </Link>
        );
      })}
    </div>
  );
}
