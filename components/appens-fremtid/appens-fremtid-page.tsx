'use client';

import { useEffect, useState, useTransition } from 'react';
import { ChangelogList } from '@/components/appens-fremtid/changelog-list';
import { RoadmapList } from '@/components/appens-fremtid/roadmap-list';
import { SectionTabs } from '@/components/appens-fremtid/section-tabs';
import { SuggestionForm } from '@/components/appens-fremtid/suggestion-form';
import { VotingList } from '@/components/appens-fremtid/voting-list';
import { PageHeader } from '@/components/page-header';
import {
  APPENS_FREMTID_TITLE,
  type ChangelogEntry,
  type RoadmapItem,
  type SuggestionRecord,
  type SuggestionVote,
} from '@/lib/appens-fremtid/constants';

type Tab = 'forslag' | 'changelog' | 'roadmap';

const TABS = [
  { id: 'forslag', label: 'Forslag' },
  { id: 'changelog', label: 'Endringslogg' },
  { id: 'roadmap', label: 'Veikart' },
] as const;

export function AppensFremtidPage() {
  const [tab, setTab] = useState<Tab>('forslag');
  const [suggestions, setSuggestions] = useState<SuggestionRecord[]>([]);
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);
  const [roadmap, setRoadmap] = useState<RoadmapItem[]>([]);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const load = () => {
    startTransition(async () => {
      setError('');
      const res = await fetch('/api/appens-fremtid');
      const data = (await res.json().catch(() => ({}))) as {
        suggestions?: SuggestionRecord[];
        changelog?: ChangelogEntry[];
        roadmap?: RoadmapItem[];
        error?: string;
      };
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Kunne ikke laste siden.');
        return;
      }
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      setChangelog(Array.isArray(data.changelog) ? data.changelog : []);
      setRoadmap(Array.isArray(data.roadmap) ? data.roadmap : []);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const vote = (id: string, nextVote: SuggestionVote) => {
    startTransition(async () => {
      setError('');
      const res = await fetch('/api/suggestions/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, vote: nextVote }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        upCount?: number;
        downCount?: number;
        myVote?: SuggestionVote;
        error?: string;
      };
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Kunne ikke registrere stemmen.');
        return;
      }
      setSuggestions((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                upCount: typeof data.upCount === 'number' ? data.upCount : item.upCount,
                downCount: typeof data.downCount === 'number' ? data.downCount : item.downCount,
                myVote: data.myVote ?? nextVote,
              }
            : item,
        ),
      );
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-12">
      <PageHeader
        title={APPENS_FREMTID_TITLE}
        description="Send inn forslag, se hva som er på vei, og stem på det vi har lagt ut."
      />

      <SectionTabs items={TABS} value={tab} onChange={setTab} label="Appens fremtid" />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {tab === 'forslag' ? (
        <div className="space-y-8">
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Til stemming</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Bare forslag vi har lagt ut vises her. Du kan stemme én gang og endre stemmen din.
              </p>
            </div>
            <VotingList suggestions={suggestions} pending={pending} onVote={vote} />
          </section>
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Nytt forslag</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Kort og konkret. Vi leser alt, men legger ikke ut alt til stemming.
              </p>
            </div>
            <SuggestionForm />
          </section>
        </div>
      ) : null}

      {tab === 'changelog' ? (
        <section className="space-y-3">
          <p className="text-sm text-muted-foreground">Hva som er endret i Folkets Stemme.</p>
          <ChangelogList entries={changelog} />
        </section>
      ) : null}

      {tab === 'roadmap' ? (
        <section className="space-y-3">
          <p className="text-sm text-muted-foreground">Det vi planlegger, jobber med eller har gjort.</p>
          <RoadmapList items={roadmap} />
        </section>
      ) : null}
    </div>
  );
}
