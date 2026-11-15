'use client';

import { useEffect, type ReactNode } from 'react';
import { StickyNote } from 'lucide-react';
import type { UserAnnotationTargetType } from '@/lib/user-annotations/types';
import { UserAnnotationProvider, useUserAnnotations } from '@/components/user-annotations/user-annotation-context';
import { UserAnnotationSelectionDialog } from '@/components/user-annotations/user-annotation-selection-dialog';
import { UserAnnotationsPanel } from '@/components/user-annotations/user-annotations-panel';

function UserAnnotationToolbar() {
  const ctx = useUserAnnotations();
  useEffect(() => {
    if (!ctx?.enabled) return;
    void ctx.refresh();
  }, [ctx]);

  useEffect(() => {
    if (!ctx?.enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'm' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        ctx.setPanelOpen(!ctx.panelOpen);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [ctx]);

  if (!ctx?.enabled) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 sm:bottom-6 sm:right-6">
      <button
        type="button"
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-md hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        aria-haspopup="dialog"
        onClick={() => ctx.setPanelOpen(true)}
      >
        <StickyNote className="h-4 w-4" aria-hidden />
        Mine notater
        {ctx.annotations.length > 0 ? (
          <span className="rounded-full bg-brand px-2 py-0.5 text-xs text-brand-foreground">
            {ctx.annotations.length}
          </span>
        ) : null}
      </button>
      <p className="max-w-[14rem] text-right text-xs text-muted-foreground">
        Marker tekst og velg lagre. Tast Ctrl+M (Cmd+M) for panelet.
      </p>
    </div>
  );
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
      <UserAnnotationToolbar />
      <UserAnnotationSelectionDialog />
      <UserAnnotationsPanel />
    </UserAnnotationProvider>
  );
}