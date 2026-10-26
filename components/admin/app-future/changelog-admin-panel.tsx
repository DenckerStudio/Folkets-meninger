'use client';

import { useMemo, useRef, useState, type TransitionStartFunction } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CharacterCountTextarea } from '@/components/ui/character-count-textarea';
import { Dialog } from '@/components/ui/dialog';
import { AdminToast, useAdminToast } from '@/components/admin/app-future/admin-toast';
import { MarkdownLite } from '@/components/admin/app-future/markdown-lite';
import { ResponsiveEditorSheet } from '@/components/admin/app-future/responsive-editor-sheet';
import { formatWhen } from '@/components/appens-fremtid/format';
import { EmptyState } from '@/components/dashboard/empty-state';
import {
  changelogDisplayWhen,
  changelogPublishLabel,
  isChangelogPublished,
} from '@/lib/appens-fremtid/changelog';
import {
  CHANGELOG_BODY_MAX,
  CHANGELOG_TITLE_MAX,
  type ChangelogEntry,
} from '@/lib/appens-fremtid/constants';
import { validateChangelogInput } from '@/lib/appens-fremtid/validate';

const ADMIN_ICON_BTN = 'max-sm:size-11';

type Draft = {
  id: string | null;
  title: string;
  body: string;
  publish: boolean;
};

function emptyDraft(): Draft {
  return { id: null, title: '', body: '', publish: false };
}

export function ChangelogAdminPanel({
  entries,
  pending,
  onChanged,
  onError,
  startTransition,
}: {
  entries: ChangelogEntry[];
  pending: boolean;
  onChanged: () => void;
  onError: (error: string) => void;
  startTransition: TransitionStartFunction;
}) {
  const sorted = useMemo(
    () =>
      entries.slice().sort((a, b) => {
        const aTime = a.publishedAt ?? a.createdAt;
        const bTime = b.publishedAt ?? b.createdAt;
        return bTime.localeCompare(aTime);
      }),
    [entries],
  );
  const { message, variant, toast } = useAdminToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [deleteTarget, setDeleteTarget] = useState<ChangelogEntry | null>(null);
  const [publishTarget, setPublishTarget] = useState<ChangelogEntry | null>(null);
  const [unpublishTarget, setUnpublishTarget] = useState<ChangelogEntry | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [sheetError, setSheetError] = useState('');
  const createIdempotencyKey = useRef(crypto.randomUUID());
  const [baseline, setBaseline] = useState<Draft>(emptyDraft);

  const validation = validateChangelogInput({
    title: draft.title,
    body: draft.body,
    publish: draft.publish,
  });
  const canSave = !('error' in validation) && !pending;

  const openNew = () => {
    const next = emptyDraft();
    createIdempotencyKey.current = crypto.randomUUID();
    setDraft(next);
    setBaseline(next);
    setSheetError('');
    setSheetOpen(true);
    onError('');
  };

  const openEdit = (entry: ChangelogEntry) => {
    const next = {
      id: entry.id,
      title: entry.title,
      body: entry.body,
      publish: isChangelogPublished(entry),
    };
    setDraft(next);
    setBaseline(next);
    setSheetError('');
    setSheetOpen(true);
    onError('');
  };

  const isDirty =
    draft.title !== baseline.title || draft.body !== baseline.body || draft.publish !== baseline.publish;

  const closeSheetWithoutSave = () => {
    setDiscardOpen(false);
    setSheetOpen(false);
    setSheetError('');
  };

  const requestCloseSheet = () => {
    if (isDirty) {
      setDiscardOpen(true);
      return;
    }
    closeSheetWithoutSave();
  };

  const save = () => {
    if ('error' in validation) {
      setSheetError(validation.error);
      onError(validation.error);
      return;
    }
    startTransition(async () => {
      onError('');
      setSheetError('');
      const res = await fetch('/api/admin/changelog', {
        method: draft.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          draft.id
            ? {
                id: draft.id,
                title: validation.title,
                body: validation.body,
                published: validation.publish,
              }
            : {
                title: validation.title,
                body: validation.body,
                publish: validation.publish,
                idempotencyKey: createIdempotencyKey.current,
              },
        ),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        const message = data.error ?? 'Kunne ikke lagre innlegget.';
        setSheetError(message);
        onError(message);
        toast('Lagring feilet', 'error');
        return;
      }
      toast(draft.id ? 'Endringslogg oppdatert' : validation.publish ? 'Endring publisert' : 'Utkast lagret');
      setSheetOpen(false);
      onChanged();
    });
  };

  const applyPublishToggle = (entry: ChangelogEntry) => {
    const published = !isChangelogPublished(entry);
    startTransition(async () => {
      onError('');
      const res = await fetch('/api/admin/changelog', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entry.id, published }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        onError(data.error ?? 'Kunne ikke oppdatere publisering.');
        return;
      }
      toast(published ? 'Publisert' : 'Avpublisert');
      onChanged();
    });
    setPublishTarget(null);
    setUnpublishTarget(null);
  };

  const remove = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      onError('');
      const res = await fetch('/api/admin/changelog', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        onError(data.error ?? 'Kunne ikke slette innlegget.');
        toast('Sletting feilet', 'error');
        return;
      }
      toast('Innlegg slettet');
      setDeleteTarget(null);
      onChanged();
    });
  };

  const sheetFooter = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          className="size-4 rounded border-border"
          checked={draft.publish}
          onChange={(event) => setDraft((prev) => ({ ...prev, publish: event.target.checked }))}
        />
        Publiser med lagring
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={requestCloseSheet}>
          Avbryt
        </Button>
        <Button id="admin-editor-save" type="button" size="sm" disabled={!canSave} onClick={save}>
          {draft.id ? 'Lagre' : draft.publish ? 'Publiser' : 'Lagre utkast'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Versjon, dato og innhold. Utkast er skjult på den offentlige siden til du publiserer.
        </p>
        <Button type="button" size="sm" onClick={openNew} disabled={pending}>
          <Plus className="size-3.5" />
          Legg til endring
        </Button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState compact title="Ingen endringslogg ennå" description="Opprett første innlegg med knappen over." />
      ) : (
        <ul className="space-y-2">
          {sorted.map((entry) => {
            const published = isChangelogPublished(entry);
            return (
              <li key={entry.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={published ? 'default' : 'secondary'}>
                        {changelogPublishLabel(entry)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatWhen(changelogDisplayWhen(entry))}
                      </span>
                    </div>
                    <h3 className="mt-2 text-sm font-semibold text-foreground">{entry.title}</h3>
                    <MarkdownLite source={entry.body} className="mt-2 text-muted-foreground" />
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11 max-sm:px-3"
                      onClick={() => {
                        if (!published) {
                          setPublishTarget(entry);
                          return;
                        }
                        setUnpublishTarget(entry);
                      }}
                    >
                      {published ? 'Avpubliser' : 'Publiser'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className={ADMIN_ICON_BTN}
                      onClick={() => openEdit(entry)}
                      aria-label="Rediger"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className={ADMIN_ICON_BTN}
                      onClick={() => setDeleteTarget(entry)}
                      aria-label="Slett"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ResponsiveEditorSheet
        open={sheetOpen}
        onClose={requestCloseSheet}
        title={draft.id ? 'Rediger endringslogg' : 'Nytt endringslogg-innlegg'}
        description="Tittel fungerer som versjon/overskrift. Cmd/Ctrl+S lagrer."
        footer={sheetFooter}
      >
        {sheetError ? (
          <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {sheetError}
          </p>
        ) : null}
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="changelog-title">
                Versjon / tittel
              </label>
              <input
                id="changelog-title"
                value={draft.title}
                maxLength={CHANGELOG_TITLE_MAX}
                onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="f.eks. «Mer oversiktlig veikart»"
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="changelog-body">
                Punkter / beskrivelse
              </label>
              <CharacterCountTextarea
                id="changelog-body"
                value={draft.body}
                maxLength={CHANGELOG_BODY_MAX}
                rows={8}
                onChange={(value) => setDraft((prev) => ({ ...prev, body: value }))}
                placeholder="- Ny funksjon&#10;- Forbedret ytelse"
              />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Forhåndsvisning (offentlig)</p>
            <article className="rounded-xl border border-border bg-muted/30 p-4">
              <Badge variant={draft.publish ? 'default' : 'secondary'} className="mb-2">
                {draft.publish ? 'Publisert' : 'Utkast'}
              </Badge>
              <h4 className="font-semibold text-foreground">{draft.title.trim() || 'Uten tittel'}</h4>
              <MarkdownLite source={draft.body || '_Ingen tekst ennå._'} className="mt-2" />
            </article>
          </div>
        </div>
      </ResponsiveEditorSheet>

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Slette innlegg?"
        description="Innlegget fjernes permanent fra endringsloggen."
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
              Avbryt
            </Button>
            <Button type="button" variant="destructive" size="sm" disabled={pending} onClick={remove}>
              Slett
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          Du sletter <strong className="text-foreground">{deleteTarget?.title ?? 'dette innlegget'}</strong>.
        </p>
      </Dialog>

      <Dialog
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="Lukke uten å lagre?"
        description="Du har ulagrede endringer i redigeringsvinduet."
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setDiscardOpen(false)}>
              Fortsett redigering
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={closeSheetWithoutSave}>
              Lukk uten å lagre
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          Endringene du har gjort blir ikke lagret hvis du lukker nå.
        </p>
      </Dialog>

      <Dialog
        open={Boolean(unpublishTarget)}
        onClose={() => setUnpublishTarget(null)}
        title="Avpublisere innlegg?"
        description="Innlegget skjules på den offentlige Appens fremtid-siden, men beholdes som utkast."
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setUnpublishTarget(null)}>
              Avbryt
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() => unpublishTarget && applyPublishToggle(unpublishTarget)}
            >
              Avpubliser
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          Du avpubliserer <strong className="text-foreground">{unpublishTarget?.title ?? 'dette innlegget'}</strong>.
        </p>
      </Dialog>

      <Dialog
        open={Boolean(publishTarget)}
        onClose={() => setPublishTarget(null)}
        title="Publisere innlegg?"
        description="Innlegget blir synlig på den offentlige Appens fremtid-siden."
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPublishTarget(null)}>
              Avbryt
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => publishTarget && applyPublishToggle(publishTarget)}
            >
              Publiser
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          Du publiserer <strong className="text-foreground">{publishTarget?.title ?? 'dette innlegget'}</strong>.
        </p>
      </Dialog>

      <AdminToast message={message} variant={variant} />
    </div>
  );
}
