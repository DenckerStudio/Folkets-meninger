import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
  tone?: 'empty' | 'error';
  /** Nested list/sidebar empties: tighter padding and no extra page heading. */
  compact?: boolean;
};

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
  tone = 'empty',
  compact = false,
}: EmptyStateProps) {
  const TitleTag = compact ? 'p' : 'h2';

  return (
    <div
      className={cn(
        'rounded-2xl border border-dashed text-center',
        compact ? 'px-4 py-8' : 'px-6 py-12',
        tone === 'error'
          ? 'border-destructive/30 bg-destructive/5'
          : 'border-border bg-card',
        className,
      )}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {icon ? <div className="mx-auto mb-4 flex justify-center">{icon}</div> : null}
      <TitleTag
        className={cn(
          'font-semibold text-foreground',
          compact ? 'text-base' : 'text-lg',
        )}
      >
        {title}
      </TitleTag>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
