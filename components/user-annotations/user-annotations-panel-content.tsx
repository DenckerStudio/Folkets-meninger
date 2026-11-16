'use client';

import { useId, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserAnnotations } from '@/components/user-annotations/user-annotation-context';
import {
  USER_ANNOTATION_FLAG_LABELS,
  USER_ANNOTATION_FLAG_STYLES,
  USER_ANNOTATION_FLAG_TYPES,
  type UserAnnotationFlagType,
} from '@/lib/user-annotations/flag-types';
import { cn } from '@/lib/utils';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2';

const FILTER_ALL = 'alle' as const;
type FlagFilter = typeof FILTER_ALL | UserAnnotationFlagType;

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

function FlagFilterBar({
  value,
  onChange,
}: {
  value: FlagFilter;
  onChange: (next: FlagFilter) => void;
}) {
  return (
    <div className="space-y-2 px-4 pt-4">
      <p className="text-xs font-medium text-muted-foreground">Filtrer på type</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={value === FILTER_ALL}
          onClick={() => onChange(FILTER_ALL)}
          className={cn(
            'min-h-11 rounded-full border px-3 text-sm',
            FOCUS_RING,
            value === FILTER_ALL
              ? 'border-brand bg-brand/10 text-foreground'
              : 'border-border bg-background text-foreground hover:bg-muted',
          )}
        >
          Alle typer
        </button>
        {USER_ANNOTATION_FLAG_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            aria-pressed={value === type}
            onClick={() => onChange(type)}
            className={cn(
              'min-h-11 rounded-full border px-3 text-sm font-medium',
              FOCUS_RING,
              value === type
                ? USER_ANNOTATION_FLAG_STYLES[type].badge
                : 'border-border bg-background text-foreground hover:bg-muted',
            )}
          >
            {USER_ANNOTATION_FLAG_LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  );
}

function AnnotationEditor({
  id,
  initialNote,
  initialFlagType,
  quote,
}: {
  id: string;
  initialNote: string | null;
  initialFlagType: UserAnnotationFlagType;
  quote: string;
}) {
  const ctx = useUserAnnotations();
  const textareaId = useId();
  const [note, setNote] = useState(initialNote ?? '');
  const [flagType, setFlagType] = useState(initialFlagType);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const save = async () => {
    if (!ctx) return;
    setBusy(true);
    setMessage('');
    const ok = await ctx.updateAnnotation(id, {
      note: note.trim() || null,
      flag_type: flagType,
    });
    setBusy(false);
    if (!ok) {
      setMessage('Kunne ikke lagre notatet. Prøv igjen.');
      return;
    }
    ctx.showToast({ message: 'Markering oppdatert', variant: 'success' });
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
      <span
        className={cn(
          'inline-flex rounded-full border px-2 py-0.5 text-xs font-medium',
          USER_ANNOTATION_FLAG_STYLES[flagType].badge,
        )}
      >
        {USER_ANNOTATION_FLAG_LABELS[flagType]}
      </span>
      <p className="mt-2 text-sm font-medium text-foreground">«{quote}»</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {USER_ANNOTATION_FLAG_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            aria-pressed={flagType === type}
            disabled={busy}
            onClick={() => setFlagType(type)}
            className={cn(
              'min-h-9 rounded-md border px-2 text-xs font-medium',
              FOCUS_RING,
              flagType === type
                ? USER_ANNOTATION_FLAG_STYLES[type].badge
                : 'border-border text-muted-foreground hover:bg-muted',
            )}
          >
            {USER_ANNOTATION_FLAG_LABELS[type]}
          </button>
        ))}
      </div>
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
  const [flagFilter, setFlagFilter] = useState<FlagFilter>(FILTER_ALL);

  const filtered = useMemo(() => {
    if (!ctx) return [];
    if (flagFilter === FILTER_ALL) return ctx.annotations;
    return ctx.annotations.filter((row) => row.flag_type === flagFilter);
  }, [ctx, flagFilter]);

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
        Henter markeringer…
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
      <div className={cn(className)}>
        <FlagFilterBar value={flagFilter} onChange={setFlagFilter} />
        <p className="px-4 py-6 text-sm text-muted-foreground">
          Du har ingen research-markeringer på denne siden ennå. Marker tekst i funnene og velg type.
        </p>
      </div>
    );
  }

  return (
    <div className={cn(className)}>
      {ctx.loadStatus === 'error' ? (
        <LoadErrorBanner onRetry={() => void ctx.refresh()} />
      ) : null}
      <FlagFilterBar value={flagFilter} onChange={setFlagFilter} />
      <ul className="space-y-3 px-4 py-4">
        {filtered.length === 0 ? (
          <li className="text-sm text-muted-foreground">Ingen markeringer med valgt type.</li>
        ) : (
          filtered.map((row) => (
            <AnnotationEditor
              key={row.id}
              id={row.id}
              quote={row.quote}
              initialNote={row.note}
              initialFlagType={row.flag_type}
            />
          ))
        )}
      </ul>
    </div>
  );
}