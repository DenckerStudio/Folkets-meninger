'use client';

import { useMemo, useState, type TransitionStartFunction } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CharacterCountTextarea } from '@/components/ui/character-count-textarea';
import { Dialog } from '@/components/ui/dialog';
import { AdminToast, useAdminToast } from '@/components/admin/app-future/admin-toast';
import { MarkdownLite } from '@/components/admin/app-future/markdown-lite';
import {
  RoadmapAdminTimelinePreview,
  RoadmapItemPreview,
} from '@/components/admin/app-future/roadmap-preview-card';
import { ResponsiveEditorSheet } from '@/components/admin/app-future/responsive-editor-sheet';
import { RoadmapStatusField } from '@/components/admin/app-future/roadmap-status-field';
import { EmptyState } from '@/components/dashboard/empty-state';
import {
  ROADMAP_BODY_MAX,
  ROADMAP_TITLE_MAX,
  roadmapStatusLabel,
  type RoadmapItem,
  type RoadmapStatus,
} from '@/lib/appens-fremtid/constants';
import { nextRoadmapSortOrder, sortRoadmapItems } from '@/lib/appens-fremtid/roadmap';
import { validateRoadmapInput } from '@/lib/appens-fremtid/validate';
import { cn } from '@/lib/utils';

const ADMIN_ICON_BTN = 'max-sm:size-11';

type Draft = {
  id: string | null;
  title: string;
  body: string;
  status: RoadmapStatus;
};

function emptyDraft(): Draft {
  return {
    id: null,
    title: '',
    body: '',
    status: 'planned',
  };
}

export function RoadmapAdminPanel({
  items,
  pending,
  onChanged,
  onError,
  startTransition,
}: {
  items: RoadmapItem[];
  pending: boolean;
  onChanged: () => void;
  onError: (error: string) => void;
  startTransition: TransitionStartFunction;
}) {
  const sorted = useMemo(() => sortRoadmapItems(items), [items]);
  const { message, variant, toast } = useAdminToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const validation = validateRoadmapInput({
    title: draft.title,
    body: draft.body,
    status: draft.status,
  });
  const canSave = !('error' in validation) && !pending;

  const openNew = () => {
    setDraft(emptyDraft());
    setSheetOpen(true);
    onError('');
  };

  const openEdit = (item: RoadmapItem) => {
    setDraft({
      id: item.id,
      title: item.title,
      body: item.body,
      status: item.status,
    });
    setSheetOpen(true);
    onError('');
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setDeleteOpen(false);
  };

  const save = () => {
    if ('error' in validation) {
      onError(validation.error);
      return;
    }
    startTransition(async () => {
      onError('');
      const sortOrder = draft.id
        ? undefined
        : nextRoadmapSortOrder(items);
      const res = await fetch('/api/admin/roadmap', {
        method: draft.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          draft.id
            ? {
                id: draft.id,
                title: validation.title,
                body: validation.body,
                status: validation.status,
              }
            : {
                title: validation.title,
                body: validation.body,
                status: validation.status,
                sortOrder,
              },
        ),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        onError(data.error ?? 'Kunne ikke lagre veikartpunktet.');
        toast('Lagring feilet', 'error');
        return;
      }
      toast(draft.id ? 'Veikartpunkt oppdatert' : 'Veikartpunkt lagt til');
      closeSheet();
      onChanged();
    });
  };

  const remove = () => {
    if (!draft.id) return;
    startTransition(async () => {
      onError('');
      const res = await fetch('/api/admin/roadmap', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: draft.id }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        onError(data.error ?? 'Kunne ikke slette veikartpunktet.');
        toast('Sletting feilet', 'error');
        return;
      }
      toast('Veikartpunkt slettet');
      closeSheet();
      onChanged();
    });
  };

  const persistOrder = (ordered: RoadmapItem[]) => {
    startTransition(async () => {
      onError('');
      const res = await fetch('/api/admin/roadmap/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: ordered.map((row) => row.id) }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        onError(data.error ?? 'Kunne ikke oppdatere rekkefølgen.');
        return;
      }
      toast('Rekkefølge oppdatert');
      onChanged();
    });
  };

  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const from = sorted.findIndex((row) => row.id === dragId);
    const to = sorted.findIndex((row) => row.id === targetId);
    if (from < 0 || to < 0) return;
    const next = sorted.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setDragId(null);
    persistOrder(next);
  };

  const moveItem = (itemId: string, direction: -1 | 1) => {
    const from = sorted.findIndex((row) => row.id === itemId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= sorted.length) return;
    const next = sorted.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    persistOrder(next);
  };

  const sheetFooter = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap gap-2">
        {draft.id ? (
          <Button type="button" variant="destructive" size="sm" disabled={pending} onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-3.5" />
            Slett
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={closeSheet}>
          Avbryt
        </Button>
        <Button id="admin-editor-save" type="button" size="sm" disabled={!canSave} onClick={save}>
          {draft.id ? 'Lagre' : 'Legg til'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Dra punktene for å endre rekkefølge. Rediger i sidepanelet med forhåndsvisning.
        </p>
        <Button type="button" size="sm" onClick={openNew} disabled={pending}>
          <Plus className="size-3.5" />
          Legg til punkt
        </Button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState compact title="Veikartet er tomt" description="Legg til det første punktet med knappen over." />
      ) : (
        <ul className="space-y-2">
          {sorted.map((item) => (
            <li
              key={item.id}
              draggable={!pending}
              onDragStart={() => setDragId(item.id)}
              onDragEnd={() => setDragId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => onDrop(item.id)}
              className={cn(
                'flex items-stretch gap-2 rounded-xl border border-border bg-card p-3 transition-colors',
                dragId === item.id && 'opacity-60',
              )}
            >
              <button
                type="button"
                className="flex cursor-grab touch-none items-center self-center rounded-lg p-2 text-muted-foreground hover:bg-muted active:cursor-grabbing"
                aria-label="Dra for å endre rekkefølge"
              >
                <GripVertical className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => openEdit(item)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-border">
                    {roadmapStatusLabel(item.status)}
                  </Badge>
                  <span className="text-sm font-semibold text-foreground">{item.title}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.body}</p>
              </button>
              <div className="flex flex-col gap-1 self-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className={ADMIN_ICON_BTN}
                  disabled={pending || sorted.findIndex((row) => row.id === item.id) === 0}
                  onClick={() => moveItem(item.id, -1)}
                  aria-label="Flytt opp"
                >
                  <ChevronUp className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className={ADMIN_ICON_BTN}
                  disabled={
                    pending || sorted.findIndex((row) => row.id === item.id) === sorted.length - 1
                  }
                  onClick={() => moveItem(item.id, 1)}
                  aria-label="Flytt ned"
                >
                  <ChevronDown className="size-3.5" />
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={ADMIN_ICON_BTN}
                onClick={() => openEdit(item)}
                aria-label="Rediger"
              >
                <Pencil className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <RoadmapAdminTimelinePreview items={sorted} highlightId={draft.id} />

      <ResponsiveEditorSheet
        open={sheetOpen}
        onClose={closeSheet}
        title={draft.id ? 'Rediger veikartpunkt' : 'Nytt veikartpunkt'}
        description="Bruk markdown i beskrivelsen (**fet**, punktlister med -). Cmd/Ctrl+S lagrer."
        footer={sheetFooter}
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="roadmap-title">
                Tittel
              </label>
              <input
                id="roadmap-title"
                value={draft.title}
                maxLength={ROADMAP_TITLE_MAX}
                onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-brand/30"
                aria-invalid={'error' in validation && validation.error.includes('Tittelen')}
              />
              {'error' in validation && validation.error.includes('Tittelen') ? (
                <p className="text-xs text-destructive">{validation.error}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="roadmap-body">
                Beskrivelse
              </label>
              <CharacterCountTextarea
                id="roadmap-body"
                value={draft.body}
                maxLength={ROADMAP_BODY_MAX}
                rows={6}
                onChange={(value) => setDraft((prev) => ({ ...prev, body: value }))}
                placeholder="Hva skal gjøres? Støtter enkel markdown."
                aria-invalid={'error' in validation && validation.error.includes('Teksten')}
              />
            </div>
            <div className="space-y-1.5">
              <span className="text-sm font-medium text-foreground">Status</span>
              <RoadmapStatusField
                value={draft.status}
                onChange={(status) => setDraft((prev) => ({ ...prev, status }))}
                disabled={pending}
              />
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Live forhåndsvisning</p>
            <RoadmapItemPreview
              title={draft.title}
              body={draft.body}
              status={draft.status}
            />
            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground">Markdown</p>
              <MarkdownLite source={draft.body || '_Ingen tekst ennå._'} className="mt-2" />
            </div>
          </div>
        </div>
      </ResponsiveEditorSheet>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Slette veikartpunkt?"
        description="Dette kan ikke angres. Punktet fjernes fra den offentlige siden."
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setDeleteOpen(false)}>
              Avbryt
            </Button>
            <Button type="button" variant="destructive" size="sm" disabled={pending} onClick={remove}>
              Slett
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          Du sletter <strong className="text-foreground">{draft.title || 'dette punktet'}</strong>.
        </p>
      </Dialog>

      <AdminToast message={message} variant={variant} />
    </div>
  );
}
