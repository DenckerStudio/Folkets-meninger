'use client';

import { Button } from '@/components/ui/button';
import { useUserAnnotations } from '@/components/user-annotations/user-annotation-context';
import { cn } from '@/lib/utils';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2';

type ToolbarPosition = {
  top: number;
  left: number;
};

function measureSelectionPosition(): ToolbarPosition | null {
  if (typeof window === 'undefined') return null;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount < 1 || selection.isCollapsed) return null;
  const rect = selection.getRangeAt(0).getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  const left = Math.min(Math.max(rect.left, 12), window.innerWidth - 168);
  const top = Math.min(rect.bottom + 8, window.innerHeight - 56);
  return { top, left };
}

export function UserAnnotationDraftToolbar() {
  const ctx = useUserAnnotations();
  if (!ctx?.enabled || !ctx.draftSelection) return null;

  const position = measureSelectionPosition();
  if (!position) return null;

  return (
    <div
      className="fixed z-[65] pointer-events-none"
      style={{ top: position.top, left: position.left }}
      role="region"
      aria-label="Lagre markering"
    >
      <Button
        type="button"
        size="sm"
        className={cn(
          'pointer-events-auto min-h-11 bg-brand text-brand-foreground shadow-md hover:bg-brand/90',
          FOCUS_RING,
        )}
        onClick={() => ctx.openSaveDialogFromDraft()}
      >
        Lagre markering
      </Button>
    </div>
  );
}