'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useUserAnnotations } from '@/components/user-annotations/user-annotation-context';
import {
  DEFAULT_USER_ANNOTATION_FLAG_TYPE,
  USER_ANNOTATION_FLAG_LABELS,
  USER_ANNOTATION_FLAG_STYLES,
  USER_ANNOTATION_FLAG_TYPES,
  type UserAnnotationFlagType,
} from '@/lib/user-annotations/flag-types';
import { cn } from '@/lib/utils';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2';

export function UserAnnotationSelectionDialog() {
  const ctx = useUserAnnotations();
  const noteId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [note, setNote] = useState('');
  const [flagType, setFlagType] = useState<UserAnnotationFlagType>(DEFAULT_USER_ANNOTATION_FLAG_TYPE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const open = Boolean(ctx?.pending);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!ctx) return null;

  const close = () => {
    ctx.setPending(null);
    setNote('');
    setFlagType(DEFAULT_USER_ANNOTATION_FLAG_TYPE);
    setError('');
  };

  const save = async () => {
    setSaving(true);
    setError('');
    const ok = await ctx.savePending({
      note: note.trim() || null,
      flag_type: flagType,
    });
    setSaving(false);
    if (!ok) {
      setError('Kunne ikke lagre. Prøv igjen.');
      return;
    }
    setNote('');
    ctx.setPanelOpen(true);
  };

  return (
    <Dialog
      key={
        ctx.pending
          ? `${ctx.pending.container_key}:${ctx.pending.start_offset}:${ctx.pending.end_offset}`
          : 'closed'
      }
      open={open}
      onClose={close}
      title="Lagre markering i research"
    >
      <div className="space-y-4" lang="nb-NO">
        {ctx.pending ? (
          <blockquote className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
            «{ctx.pending.quote}»
          </blockquote>
        ) : null}

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground">Type markering</legend>
          <div className="flex flex-wrap gap-2">
            {USER_ANNOTATION_FLAG_TYPES.map((type) => {
              const selected = flagType === type;
              const label = USER_ANNOTATION_FLAG_LABELS[type];
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setFlagType(type)}
                  className={cn(
                    'min-h-11 rounded-full border px-3 text-sm font-medium transition-colors',
                    FOCUS_RING,
                    selected
                      ? USER_ANNOTATION_FLAG_STYLES[type].badge
                      : 'border-border bg-background text-foreground hover:bg-muted',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor={noteId} className="text-sm font-medium text-foreground">
            Notat (valgfritt)
          </label>
          <textarea
            id={noteId}
            ref={inputRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            className={cn(
              'mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground',
              FOCUS_RING,
            )}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void save();
              }
            }}
          />
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className={cn('min-h-11 bg-brand text-brand-foreground hover:bg-brand/90', FOCUS_RING)}
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? 'Lagrer…' : 'Lagre markering'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className={cn('min-h-11', FOCUS_RING)}
            onClick={close}
          >
            Avbryt
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Hurtigtast: Ctrl+Enter (Cmd+Enter på Mac) for å lagre.</p>
      </div>
    </Dialog>
  );
}