'use client';

import type { ReactNode } from 'react';
import { StickyNote } from 'lucide-react';
import type { UserAnnotationTargetType } from '@/lib/user-annotations/types';
import { UserAnnotationProvider, useUserAnnotations } from '@/components/user-annotations/user-annotation-context';
import { UserAnnotationSelectionDialog } from '@/components/user-annotations/user-annotation-selection-dialog';
import { UserAnnotationsPanel } from '@/components/user-annotations/user-annotations-panel';
import { UserAnnotationSelectionCapture } from '@/components/user-annotations/user-annotation-selection-capture';
import { UserAnnotationDraftToolbar } from '@/components/user-annotations/user-annotation-draft-toolbar';
import { UserAnnotationToast } from '@/components/user-annotations/user-annotation-toast';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2';

function UserAnnotationToolbar() {
  const ctx = useUserAnnotations();
  if (!ctx?.enabled) return null;

  return (
    <div
      className={cn(
        'fixed z-[60]',
        'bottom-[max(1rem,env(safe-area-inset-bottom,0px))]',
        'right-[max(1rem,env(safe-area-inset-right,0px))]',
        'max-sm:left-[max(1rem,env(safe-area-inset-left,0px))]',
      )}
    >
      <Button
        type="button"
        variant="outline"
        className={cn(
          'min-h-11 gap-2 rounded-full border-border bg-card px-4 shadow-md hover:bg-muted',
          'max-sm:w-full max-sm:justify-center',
          FOCUS_RING,
        )}
        aria-haspopup="dialog"
        aria-expanded={ctx.panelOpen}
        onClick={() => ctx.setPanelOpen(true)}
      >
        <StickyNote className="h-4 w-4" aria-hidden />
        Mine notater
        {ctx.annotations.length > 0 ? (
          <span className="rounded-full bg-brand px-2 py-0.5 text-xs text-brand-foreground">
            {ctx.annotations.length}
          </span>
        ) : null}
      </Button>
    </div>
  );
}

function UserAnnotationToastHost() {
  const ctx = useUserAnnotations();
  return <UserAnnotationToast toast={ctx?.toast ?? null} />;
}

export function UserAnnotationHost({
  enabled,
  targetType,
  targetId,
  children,
}: {
  enabled: boolean;
  targetType: UserAnnotationTargetType;
  targetId: string;
  children: ReactNode;
}) {
  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <UserAnnotationProvider enabled={enabled} targetType={targetType} targetId={targetId}>
      {children}
      <UserAnnotationSelectionCapture />
      <UserAnnotationDraftToolbar />
      <UserAnnotationToolbar />
      <UserAnnotationSelectionDialog />
      <UserAnnotationsPanel />
      <UserAnnotationToastHost />
    </UserAnnotationProvider>
  );
}