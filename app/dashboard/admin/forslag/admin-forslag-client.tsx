'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Lightbulb } from 'lucide-react';
import { AdminBackLink } from '@/components/admin/admin-shell';
import { formatWhen } from '@/components/appens-fremtid/format';
import { RoadmapEditor } from '@/components/appens-fremtid/roadmap-editor';
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
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const load = () => {
    startTransition(async () => {
      setError('');
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

      if (!suggestionsRes.ok || !changelogRes.ok || !roadmapRes.ok) {
        setError(
          suggestionsData.error ||
            changelogData.error ||
            roadmapData.error ||
            'Kunne ikke laste Appens fremtid.',
        );
        return;
      }

      setSuggestions(Array.isArray(suggestionsData.suggestions) ? suggestionsData.suggestions : []);
      setChangelog(Array.isArray(changelogData.entries) ? changelogData.entries : []);
      setRoadmap(Array.isArray(roadmapData.items) ? roadmapData.items : []);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const patchSuggestion = (payload: Record<string, unknown>) => {
    startTransition(async () => {
      setError('');
      const res = await fetch('/api/admin/suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Kunne ikke oppdatere forslaget.');
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

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {tab === 'inbox' ? (
        <InboxPanel
          counts={counts}
          filter={filter}
          onFilter={setFilter}
          pending={pending}
          suggestions={visible}
          onStatus={(id, status) => patchSuggestion({ id, status })}
          onVoting={(id, votingOpen) => patchSuggestion({ id, votingOpen })}
        />
      ) : null}

      {tab === 'changelog' ? (
        <ChangelogPanel
          entries={changelog}
          pending={pending}
          onCreated={load}
          onDeleted={load}
          onError={setError}
          startTransition={startTransition}
        />
      ) : null}

      {tab === 'roadmap' ? (
        <RoadmapEditor
          items={roadmap}
          pending={pending}
          onChanged={load}
          onError={setError}
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
  onStatus,
  onVoting,
}: {
  counts: { all: number; new: number; handled: number; voting: number };
  filter: InboxFilter;
  onFilter: (filter: InboxFilter) => void;
  pending: boolean;
  suggestions: SuggestionRecord[];
  onStatus: (id: string, status: SuggestionStatus) => void;
  onVoting: (id: string, votingOpen: boolean) => void;
}) {
  return (
    <div className="space-y-4">
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
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {pending ? 'Laster forslag…' : 'Ingen forslag i denne listen ennå.'}
        </p>
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

function ChangelogPanel({
  entries,
  pending,
  onCreated,
  onDeleted,
  onError,
  startTransition,
}: {
  entries: ChangelogEntry[];
  pending: boolean;
  onCreated: () => void;
  onDeleted: () => void;
  onError: (error: string) => void;
  startTransition: ReturnType<typeof useTransition>[1];
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const publish = () => {
    startTransition(async () => {
      onError('');
      const res = await fetch('/api/admin/changelog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        onError(typeof data.error === 'string' ? data.error : 'Kunne ikke publisere innlegget.');
        return;
      }
      setTitle('');
      setBody('');
      onCreated();
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      onError('');
      const res = await fetch('/api/admin/changelog', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        onError(typeof data.error === 'string' ? data.error : 'Kunne ikke slette innlegget.');
        return;
      }
      onDeleted();
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Publiser endring</h3>
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
          placeholder="Hva er nytt?"
          className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-brand/30"
        />
        <button
          type="button"
          disabled={pending}
          onClick={publish}
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50"
        >
          Publiser
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Ingen endringslogg ennå.
        </p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{entry.title}</p>
                  <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{entry.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatWhen(entry.publishedAt || entry.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => remove(entry.id)}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  Slett
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

