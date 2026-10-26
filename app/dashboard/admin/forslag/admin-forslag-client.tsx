'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Lightbulb } from 'lucide-react';
import { AdminBackLink } from '@/components/admin/admin-shell';
import { EmptyState } from '@/components/dashboard/empty-state';
import { formatWhen } from '@/components/appens-fremtid/format';
import { ChangelogAdminPanel } from '@/components/admin/app-future/changelog-admin-panel';
import { RoadmapAdminPanel } from '@/components/admin/app-future/roadmap-admin-panel';
import { SectionTabs } from '@/components/appens-fremtid/section-tabs';
import {
  APPENS_FREMTID_TITLE,
  isSuggestionStatus,
  suggestionAudienceLabel,
  suggestionCategoryLabel,
  suggestionStatusLabel,
  type ChangelogEntry,
  type RoadmapItem,
  type SuggestionRecord,
  type SuggestionStatus,
} from '@/lib/appens-fremtid/constants';

type PageTab = 'inbox' | 'changelog' | 'roadmap';
type InboxFilter = 'all' | 'voting' | SuggestionStatus;

const PAGE_TABS = [
  { id: 'inbox', label: 'Innboks' },
  { id: 'changelog', label: 'Endringslogg' },
  { id: 'roadmap', label: 'Veikart' },
] as const;

export default function AdminForslagClient() {
  const [tab, setTab] = useState<PageTab>('inbox');
  const [suggestions, setSuggestions] = useState<SuggestionRecord[]>([]);
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);
  const [roadmap, setRoadmap] = useState<RoadmapItem[]>([]);
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [inboxError, setInboxError] = useState('');
  const [pending, startTransition] = useTransition();

  const load = () => {
    startTransition(async () => {
      const [suggestionsRes, changelogRes, roadmapRes] = await Promise.all([
        fetch('/api/admin/suggestions'),
        fetch('/api/admin/changelog'),
        fetch('/api/admin/roadmap'),
      ]);
      const suggestionsData = (await suggestionsRes.json().catch(() => ({}))) as {
        suggestions?: SuggestionRecord[];
        error?: string;
      };
      const changelogData = (await changelogRes.json().catch(() => ({}))) as {
        entries?: ChangelogEntry[];
        error?: string;
      };
      const roadmapData = (await roadmapRes.json().catch(() => ({}))) as {
        items?: RoadmapItem[];
        error?: string;
      };

      if (!suggestionsRes.ok) {
        setInboxError(
          typeof suggestionsData.error === 'string' ? suggestionsData.error : 'Kunne ikke laste forslag.',
        );
      } else {
        setInboxError('');
        setSuggestions(Array.isArray(suggestionsData.suggestions) ? suggestionsData.suggestions : []);
      }

      if (changelogRes.ok) {
        setChangelog(Array.isArray(changelogData.entries) ? changelogData.entries : []);
      }
      if (roadmapRes.ok) {
        setRoadmap(Array.isArray(roadmapData.items) ? roadmapData.items : []);
      }
    });
  };

  useEffect(() => {
    load();
  }, []);

  const patchSuggestion = (payload: Record<string, unknown>) => {
    startTransition(async () => {
      setInboxError('');
      const res = await fetch('/api/admin/suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setInboxError(typeof data.error === 'string' ? data.error : 'Kunne ikke oppdatere forslaget.');
        return;
      }
      load();
    });
  };

  const counts = useMemo(() => {
    const next = { all: suggestions.length, new: 0, handled: 0, voting: 0 };
    for (const suggestion of suggestions) {
      if (suggestion.status === 'new') next.new += 1;
      if (suggestion.status === 'handled') next.handled += 1;
      if (suggestion.votingOpen) next.voting += 1;
    }
    return next;
  }, [suggestions]);

  const visible = suggestions.filter((suggestion) => {
    if (filter === 'all') return true;
    if (filter === 'voting') return suggestion.votingOpen;
    return suggestion.status === filter;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Lightbulb className="h-5 w-5 text-brand" aria-hidden />
          {APPENS_FREMTID_TITLE}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Les innkommende forslag, åpne noen for stemming, og publiser endringslogg og veikart.
        </p>
      </div>

      <SectionTabs items={PAGE_TABS} value={tab} onChange={setTab} label="Admin Appens fremtid" />

      {tab === 'inbox' ? (
        <InboxPanel
          counts={counts}
          filter={filter}
          onFilter={setFilter}
          pending={pending}
          suggestions={visible}
          inboxError={inboxError}
          onStatus={(id, status) => patchSuggestion({ id, status })}
          onVoting={(id, votingOpen) => patchSuggestion({ id, votingOpen })}
        />
      ) : null}

      {tab === 'changelog' ? (
        <ChangelogAdminPanel
          entries={changelog}
          pending={pending}
          onChanged={load}
          onError={() => {}}
          startTransition={startTransition}
        />
      ) : null}

      {tab === 'roadmap' ? (
        <RoadmapAdminPanel
          items={roadmap}
          pending={pending}
          onChanged={load}
          onError={() => {}}
          startTransition={startTransition}
        />
      ) : null}

      <AdminBackLink />
    </div>
  );
}

function InboxPanel({
  counts,
  filter,
  onFilter,
  pending,
  suggestions,
  inboxError,
  onStatus,
  onVoting,
}: {
  counts: { all: number; new: number; handled: number; voting: number };
  filter: InboxFilter;
  onFilter: (filter: InboxFilter) => void;
  pending: boolean;
  suggestions: SuggestionRecord[];
  inboxError: string;
  onStatus: (id: string, status: SuggestionStatus) => void;
  onVoting: (id: string, votingOpen: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      {inboxError ? <p className="text-sm text-destructive" role="alert">{inboxError}</p> : null}
      <p className="text-sm text-muted-foreground">
        Forslag som ikke er lagt ut til stemming blir her. Åpne et forslag for stemming når andre skal kunne stemme.
      </p>
      <SectionTabs
        items={[
          { id: 'all', label: `Alle (${counts.all})` },
          { id: 'new', label: `Nye (${counts.new})` },
          { id: 'voting', label: `Til stemming (${counts.voting})` },
          { id: 'handled', label: `Behandlet (${counts.handled})` },
        ]}
        value={filter}
        onChange={onFilter}
        label="Filtrer forslag"
      />

      {suggestions.length === 0 ? (
        <EmptyState
          compact
          title={pending ? 'Laster forslag…' : 'Ingen forslag i denne listen ennå'}
          description={
            pending
              ? 'Henter innkommende forslag.'
              : 'Når noen sender inn et forslag, vises det her.'
          }
        />
      ) : (
        <ul className="space-y-3">
          {suggestions.map((suggestion) => {
            const status = isSuggestionStatus(suggestion.status) ? suggestion.status : 'new';
            return (
              <li key={suggestion.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{suggestion.title}</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{suggestion.body}</p>
                    <p className="text-xs text-muted-foreground">
                      {suggestionCategoryLabel(suggestion.category)} ·{' '}
                      {suggestionAudienceLabel(suggestion.audience)}
                      {suggestion.authorName ? ` · ${suggestion.authorName}` : ''}
                      {suggestion.createdAt ? ` · ${formatWhen(suggestion.createdAt)}` : ''}
                    </p>
                    {suggestion.votingOpen ? (
                      <p className="text-xs text-muted-foreground">
                        Stemmer: {suggestion.upCount} for / {suggestion.downCount} mot
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={
                      status === 'handled'
                        ? 'shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground'
                        : 'shrink-0 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand'
                    }
                  >
                    {suggestion.votingOpen ? 'Til stemming' : suggestionStatusLabel(status)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {suggestion.votingOpen ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onVoting(suggestion.id, false)}
                      className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
                    >
                      Lukk stemming
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onVoting(suggestion.id, true)}
                      className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50"
                    >
                      Åpne for stemming
                    </button>
                  )}
                  {status === 'new' ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onStatus(suggestion.id, 'handled')}
                      className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
                    >
                      Merk som behandlet
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onStatus(suggestion.id, 'new')}
                      className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
                    >
                      Merk som ny
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

