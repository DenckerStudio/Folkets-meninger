'use client';

import { useId, useState } from 'react';
import { Drawer } from '@/components/ui/drawer';
import { useUserAnnotations } from '@/components/user-annotations/user-annotation-context';
import { cn } from '@/lib/utils';

function AnnotationEditor({
  id,
  initialNote,
  quote,
  onSaved,
  onDeleted,
}: {
  id: string;
  initialNote: string | null;
  quote: string;
  onSaved: () => void;
  onDeleted: () => void;
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
      setMessage('Kunne ikke lagre notatet.');
      return;
    }
    onSaved();
  };

  const remove = async () => {
    if (!ctx) return;
    setBusy(true);
    const ok = await ctx.removeAnnotation(id);
    setBusy(false);
    if (!ok) {
      setMessage('Kunne ikke slette.');
      return;
    }
    onDeleted();
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
        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
      />
      {message ? <p className="mt-1 text-xs text-destructive">{message}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="inline-flex min-h-11 items-center rounded-md bg-brand px-3 text-sm font-medium text-brand-foreground"
        >
          Lagre
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void remove()}
          className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-medium text-foreground"
        >
          Slett
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-brand hover:underline"
          onClick={() => {
            ctx?.setFocusAnnotationId(id);
            const el = document.querySelector(`[data-annotation-id="${CSS.escape(id)}"]`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
        >
          Vis i tekst
        </button>
      </div>
    </li>
  );
}

export function UserAnnotationsPanel() {
  const ctx = useUserAnnotations();
  if (!ctx?.enabled) return null;

  return (
  <Drawer
      open={ctx.panelOpen}
      onClose={() => ctx.setPanelOpen(false)}
      title="Mine notater"
      description="Private markeringer — bare synlig for deg."
      className="max-h-[85vh]"
    >
      {ctx.annotations.length === 0 ? (
        <p className="text-sm text-muted-foreground">Du har ingen lagrede markeringer på denne siden ennå.</p>
      ) : (
        <ul className={cn('space-y-3 overflow-y-auto pb-4')}>
          {ctx.annotations.map((row) => (
            <AnnotationEditor
              key={row.id}
              id={row.id}
              quote={row.quote}
              initialNote={row.note}
              onSaved={() => undefined}
              onDeleted={() => undefined}
            />
          ))}
        </ul>
      )}
    </Drawer>
  );
}