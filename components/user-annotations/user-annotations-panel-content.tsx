'use client';

import { useId, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserAnnotations } from '@/components/user-annotations/user-annotation-context';
import { cn } from '@/lib/utils';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2';

function LoadErrorBanner({ onRetry }: { onRetry: () => void }) {
  const ctx = useUserAnnotations();
  return (
    <div className="mx-4 mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3" role="alert">
      <p className="text-sm text-destructive">{ctx?.loadError ?? 'Kunne ikke hente notater.'}</p>
      <Button
        type="button"
        variant="outline"
        className={cn('mt-2 min-h-11', FOCUS_RING)}
        onClick={onRetry}
      >
        Prøv igjen
      </Button>
    </div>
  );
}

function AnnotationEditor({
  id,
  initialNote,
  quote,
}: {
  id: string;
  initialNote: string | null;
  quote: string;
}) {
  const ctx = useUserAnnotations();
  const textareaId = useId();
  const [note, setNote] = useState(initialNote ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const save = async () => {
    if (!ctx) return;
    setBusy(true);
    setMessage('');
    const ok = await ctx.updateNote(id, note.trim() || null);
    setBusy(false);
    if (!ok) {
      setMessage('Kunne ikke lagre notatet. Prøv igjen.');
      return;
    }
    ctx.showToast({ message: 'Notat lagret', variant: 'success' });
  };

  const remove = async () => {
    if (!ctx) return;
    setBusy(true);
    setMessage('');
    const ok = await ctx.removeAnnotation(id);
    setBusy(false);
    if (!ok) {
      setMessage('Kunne ikke slette. Prøv igjen.');
    }
  };

  return (
    <li className="rounded-lg border border-border bg-card p-3">
      <p className="text-sm font-medium text-foreground">«{quote}»</p>
      <label htmlFor={textareaId} className="mt-2 block text-xs font-medium text-muted-foreground">
        Notat
      </label>
      <textarea
        id={textareaId}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        className={cn(
          'mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm',
          FOCUS_RING,
        )}
      />
      {message ? (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {message}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={busy}
          className={cn('min-h-11 bg-brand text-brand-foreground hover:bg-brand/90', FOCUS_RING)}
          onClick={() => void save()}
        >
          Lagre
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          className={cn('min-h-11', FOCUS_RING)}
          onClick={() => void remove()}
        >
          Slett
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn('min-h-11', FOCUS_RING)}
          onClick={() => {
            ctx?.setPanelOpen(false);
            void ctx?.revealAnnotation(id);
          }}
        >
          Vis i tekst
        </Button>
      </div>
    </li>
  );
}

export function UserAnnotationsPanelContent({ className }: { className?: string }) {
  const ctx = useUserAnnotations();
  if (!ctx?.enabled) return null;

  const showInitialLoading = ctx.loadStatus === 'loading' && ctx.annotations.length === 0;
  const showEmpty =
    ctx.loadStatus !== 'error' && ctx.loadStatus !== 'loading' && ctx.annotations.length === 0;
  const showErrorOnly = ctx.loadStatus === 'error' && ctx.annotations.length === 0;

  if (showInitialLoading) {
    return (
      <div
        className={cn('flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground', className)}
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Henter notater…
      </div>
    );
  }

  if (showErrorOnly) {
    return (
      <div className={cn('px-4 py-6', className)}>
        <LoadErrorBanner onRetry={() => void ctx.refresh()} />
      </div>
    );
  }

  if (showEmpty) {
    return (
      <p className={cn('px-4 py-6 text-sm text-muted-foreground', className)}>
        Du har ingen lagrede markeringer på denne siden ennå.
      </p>
    );
  }

  return (
    <div className={cn(className)}>
      {ctx.loadStatus === 'error' ? (
        <LoadErrorBanner onRetry={() => void ctx.refresh()} />
      ) : null}
      <ul className="space-y-3 px-4 py-4">
        {ctx.annotations.map((row) => (
          <AnnotationEditor key={row.id} id={row.id} quote={row.quote} initialNote={row.note} />
        ))}
      </ul>
    </div>
  );
}