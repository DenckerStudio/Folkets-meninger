'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { ForumReportButton } from '@/components/forum/forum-report-button';
import { routes } from '@/lib/routes';

type ForumPostActionsProps = {
  targetType: 'thread' | 'reply';
  targetId: string;
  isOwner: boolean;
  threadId?: string;
  redirectAfterThreadDelete?: string;
};

export function ForumPostActions({
  targetType,
  targetId,
  isOwner,
  threadId,
  redirectAfterThreadDelete,
}: ForumPostActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const handleDelete = async () => {
    const label = targetType === 'thread' ? 'tråden' : 'svaret';
    if (!window.confirm(`Er du sikker på at du vil slette ${label}? Dette kan ikke angres.`)) {
      return;
    }

    setDeleting(true);
    setError(null);

    const res = await fetch('/api/forum', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: targetType === 'thread' ? 'delete_thread' : 'delete_reply',
        target_id: targetId,
      }),
    });

    const json = await res.json().catch(() => ({}));
    setDeleting(false);

    if (!res.ok) {
      setError(typeof json.error === 'string' ? json.error : 'Kunne ikke slette');
      return;
    }

    setOpen(false);

    if (targetType === 'thread') {
      router.push(redirectAfterThreadDelete ?? routes.forum);
      router.refresh();
      return;
    }

    if (threadId) {
      router.push(`${routes.forumTopic(threadId)}`);
      router.refresh();
    }
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="p-1.5 rounded-md text-muted-foreground hover:text-muted-foreground hover:bg-muted"
        aria-label="Flere handlinger"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-border bg-card py-1 shadow-lg">
          {isOwner && (
            <button
              type="button"
              disabled={deleting}
              onClick={handleDelete}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? 'Sletter…' : 'Slett'}
            </button>
          )}
          <ForumReportButton
            targetType={targetType}
            targetId={targetId}
            variant="menu-item"
            onDone={() => setOpen(false)}
          />
          {error && <p className="px-3 py-2 text-xs text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}
