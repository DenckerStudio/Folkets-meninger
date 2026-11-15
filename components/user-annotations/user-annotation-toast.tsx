'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { UserAnnotationToastState } from '@/components/user-annotations/user-annotation-context';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2';

export function UserAnnotationToast({ toast }: { toast: UserAnnotationToastState | null }) {
  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-none fixed z-[85] flex max-w-[min(24rem,calc(100vw-2rem))] items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg',
        'bottom-[max(5.5rem,calc(4.5rem+env(safe-area-inset-bottom,0px)))] left-1/2 -translate-x-1/2',
        toast.variant === 'success'
          ? 'border-border bg-card text-foreground'
          : 'border-destructive/40 bg-destructive/10 text-destructive',
      )}
    >
      <span className="min-w-0 flex-1">{toast.message}</span>
      {toast.actionLabel && toast.onAction ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn('pointer-events-auto min-h-11 shrink-0', FOCUS_RING)}
          onClick={() => toast.onAction?.()}
        >
          {toast.actionLabel}
        </Button>
      ) : null}
    </div>
  );
}