'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useUserAnnotations } from '@/components/user-annotations/user-annotation-context';
import { cn } from '@/lib/utils';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2';

export function UserAnnotationSelectionDialog() {
  const ctx = useUserAnnotations();
  const noteId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [note, setNote] = useState('');
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
    setError('');
  };

  const save = async () => {
    setSaving(true);
    setError('');
    const ok = await ctx.savePending(note.trim() || null);
    setSaving(false);
    if (!ok) {
      setError('Kunne ikke lagre. Prøv igjen.');
      return;
    }
    ctx.setPanelOpen(true);
  };

  return (
    <Dialog open={open} onClose={close} title="Lagre markering">
      <div className="space-y-4" lang="nb-NO">
        {ctx.pending ? (
          <blockquote className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
            «{ctx.pending.quote}»
          </blockquote>
        ) : null}
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