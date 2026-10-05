import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  tone?: 'empty' | 'error';
};

export function EmptyState({
  title,
  description,
  action,
  className,
  tone = 'empty',
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-dashed px-6 py-12 text-center',
        tone === 'error'
          ? 'border-destructive/30 bg-destructive/5'
          : 'border-border bg-card',
        className,
      )}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
