'use client';

import { useState, type TransitionStartFunction } from 'react';
import { LandingRoadmap } from '@/components/landing-roadmap';
import { Pressable } from '@/components/motion/pressable';
import {
  ROADMAP_STATUSES,
  roadmapStatusLabel,
  type RoadmapItem,
  type RoadmapStatus,
} from '@/lib/appens-fremtid/constants';
import { nextRoadmapSortOrder } from '@/lib/appens-fremtid/roadmap';

export function RoadmapEditor({
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<RoadmapStatus>('planned');
  const [sortOrderDraft, setSortOrderDraft] = useState<string | null>(null);

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const sortOrder = sortOrderDraft ?? String(selected?.sortOrder ?? nextRoadmapSortOrder(items));

  const fill = (item: RoadmapItem | null) => {
    setSelectedId(item?.id ?? null);
    setTitle(item?.title ?? '');
    setBody(item?.body ?? '');
    setStatus(item?.status ?? 'planned');
    setSortOrderDraft(item ? String(item.sortOrder) : null);
  };

  const save = () => {
    startTransition(async () => {
      onError('');
      const payload = {
        title,
        body,
        status,
        sortOrder: Number(sortOrder),
        ...(selected ? { id: selected.id } : {}),
      };
      const res = await fetch('/api/admin/roadmap', {
        method: selected ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        onError(
          typeof data.error === 'string'
            ? data.error
            : selected
              ? 'Kunne ikke oppdatere veikartpunktet.'
              : 'Kunne ikke publisere veikartpunktet.',
        );
        return;
      }
      fill(null);
      onChanged();
    });
  };

  const remove = () => {
    if (!selected) return;
    startTransition(async () => {
      onError('');
      const res = await fetch('/api/admin/roadmap', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        onError(typeof data.error === 'string' ? data.error : 'Kunne ikke slette veikartpunktet.');
        return;
      }
      fill(null);
      onChanged();
    });
  };

  return (
    <div className="space-y-8">
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">
          {selected ? 'Rediger veikartpunkt' : 'Nytt veikartpunkt'}
        </h3>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Kort tittel"
          className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-brand/30"
        />
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={4}
          placeholder="Hva skal gjøres?"
          className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-brand/30"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as RoadmapStatus)}
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-brand/30"
          >
            {ROADMAP_STATUSES.map((item) => (
              <option key={item} value={item}>
                {roadmapStatusLabel(item)}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            max={9999}
            value={sortOrder}
            onChange={(event) => setSortOrderDraft(event.target.value)}
            aria-label="Rekkefølge"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Pressable
            disabled={pending}
            onClick={save}
            className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {selected ? 'Lagre' : 'Legg til'}
          </Pressable>
          {selected ? (
            <>
              <Pressable
                disabled={pending}
                onClick={() => fill(null)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground disabled:opacity-50"
              >
                Avbryt
              </Pressable>
              <Pressable
                disabled={pending}
                onClick={remove}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground disabled:opacity-50"
              >
                Slett
              </Pressable>
            </>
          ) : null}
        </div>
      </div>

      <LandingRoadmap items={items} selectedId={selectedId} onSelect={fill} />
    </div>
  );
}
