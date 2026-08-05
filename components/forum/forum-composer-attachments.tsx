'use client';

import { useEffect, useState } from 'react';
import { AtSign, FileText, Link2 } from 'lucide-react';
import ContextPicker, { ContextChip } from '@/components/forum/context-picker';
import {
  contextItemKey,
  externalSourceItem,
  sakContextItem,
  type ForumContextItem,
} from '@/lib/forum/context';
import { parseUrl } from '@/lib/forum/sanitize-links';
import { cn } from '@/lib/utils';

export type ComposerAttachPanel = 'sak' | 'politiker' | 'kilde' | null;

type ForumComposerAttachmentsProps = {
  panel: ComposerAttachPanel;
  onPanelChange: (panel: ComposerAttachPanel) => void;
  linkedItems: ForumContextItem[];
  linkedKeys: Set<string>;
  primarySakId: string | null;
  onSelect: (item: ForumContextItem) => void;
  onRemove: (item: ForumContextItem) => void;
  onSetPrimarySak: (id: string, title: string) => void;
  suggestedIssues: { id: string; title: string }[];
  onPoliticianPanelOpen?: () => void;
};

function attachButtonClass(active: boolean) {
  return cn(
    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
    active
      ? 'bg-primary text-primary-foreground'
      : 'bg-muted text-foreground hover:bg-muted/80',
  );
}

export function ForumComposerAttachments({
  panel,
  onPanelChange,
  linkedItems,
  linkedKeys,
  primarySakId,
  onSelect,
  onRemove,
  onSetPrimarySak,
  suggestedIssues,
  onPoliticianPanelOpen,
}: ForumComposerAttachmentsProps) {
  const [popularPoliticians, setPopularPoliticians] = useState<ForumContextItem[]>([]);
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceError, setSourceError] = useState('');

  useEffect(() => {
    if (panel !== 'politiker') return;
    onPoliticianPanelOpen?.();
    fetch('/api/forum/popular-politicians')
      .then((res) => res.json())
      .then((data) => setPopularPoliticians(data.results ?? []))
      .catch(() => setPopularPoliticians([]));
  }, [panel, onPoliticianPanelOpen]);

  const togglePanel = (next: ComposerAttachPanel) => {
    onPanelChange(panel === next ? null : next);
    setSourceError('');
  };

  const addSource = () => {
    const built = externalSourceItem(sourceUrl);
    if ('error' in built) {
      setSourceError(built.error);
      return;
    }
    const parsed = parseUrl(built.item.href);
    if (!parsed?.isAllowed) {
      setSourceError('Kilden må være fra et godkjent medium (f.eks. vg.no, nrk.no, aftenposten.no).');
      return;
    }
    onSelect(built.item);
    setSourceUrl('');
    setSourceError('');
    onPanelChange(null);
  };

  const quickSak = suggestedIssues.filter((s) => s.id !== primarySakId).slice(0, 4);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={attachButtonClass(panel === 'sak')} onClick={() => togglePanel('sak')}>
          <FileText className="h-3.5 w-3.5" aria-hidden />
          Relevante saker
        </button>
        <button
          type="button"
          className={attachButtonClass(panel === 'politiker')}
          onClick={() => togglePanel('politiker')}
        >
          <AtSign className="h-3.5 w-3.5" aria-hidden />
          Politiker
        </button>
        <button type="button" className={attachButtonClass(panel === 'kilde')} onClick={() => togglePanel('kilde')}>
          <Link2 className="h-3.5 w-3.5" aria-hidden />
          Kilde
        </button>
      </div>

      {panel === 'sak' ? (
        <div className="rounded-2xl bg-muted/90 p-3">
          <ContextPicker
            onSelect={onSelect}
            selectedKeys={linkedKeys}
            placeholder="Søk stortingssaker…"
            lockedKind="sak"
            compact
          />
          {quickSak.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {quickSak.map((issue) => (
                <button
                  key={issue.id}
                  type="button"
                  onClick={() => onSelect(sakContextItem(issue.id, issue.title))}
                  className="rounded-full bg-card px-3 py-1.5 text-left text-xs font-medium text-foreground shadow-sm ring-1 ring-border/80 hover:bg-muted/50"
                >
                  <span className="line-clamp-1">{issue.title}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {panel === 'politiker' ? (
        <div className="rounded-2xl bg-muted/90 p-3">
          <ContextPicker
            onSelect={onSelect}
            selectedKeys={linkedKeys}
            placeholder="Søk etter politiker…"
            lockedKind="politician"
            compact
          />
          {popularPoliticians.length > 0 ? (
            <div className="mt-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Mest omtalt i forumet</p>
              <div className="flex flex-wrap gap-2">
                {popularPoliticians.map((item) => (
                  <button
                    key={contextItemKey(item)}
                    type="button"
                    disabled={linkedKeys.has(contextItemKey(item))}
                    onClick={() => onSelect(item)}
                    className="rounded-full bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm ring-1 ring-border/80 hover:bg-muted/50 disabled:opacity-40"
                  >
                    @{item.title.split(/\s+/)[0]}
                    {item.meta ? <span className="text-muted-foreground"> · {item.meta}</span> : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {panel === 'kilde' ? (
        <div className="rounded-2xl bg-muted/90 p-3 space-y-2">
          <label htmlFor="forum-source-url" className="sr-only">
            Kilde-URL
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="forum-source-url"
              type="url"
              value={sourceUrl}
              onChange={(e) => {
                setSourceUrl(e.target.value);
                setSourceError('');
              }}
              placeholder="vg.no/artikkel eller https://…"
              className="flex-1 rounded-xl border-0 bg-card px-3 py-2 text-sm text-foreground ring-1 ring-border/80 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
            />
            <button
              type="button"
              onClick={addSource}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Legg til
            </button>
          </div>
          {sourceError ? <p className="text-xs text-destructive">{sourceError}</p> : null}
          <p className="text-xs text-muted-foreground">Godkjente kilder inkluderer bl.a. vg.no, nrk.no og aftenposten.no.</p>
        </div>
      ) : null}

      {linkedItems.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {linkedItems.map((item) => (
            <ContextChip
              key={contextItemKey(item)}
              item={item}
              isPrimary={item.kind === 'sak' && item.id === primarySakId}
              onPrimary={
                item.kind === 'sak'
                  ? () => onSetPrimarySak(item.id, item.title)
                  : undefined
              }
              onRemove={() => onRemove(item)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
