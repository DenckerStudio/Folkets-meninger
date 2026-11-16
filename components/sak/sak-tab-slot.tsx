import { cn } from '@/lib/utils';

/** Placeholder panel for PR B components (argumenter, søk, filtrering, mv.). */
export function SakTabSlot({
  title,
  description,
  className,
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-dashed border-border bg-muted/15 px-4 py-8 text-center sm:px-6',
        className,
      )}
      data-sak-tab-slot={title}
    >
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}