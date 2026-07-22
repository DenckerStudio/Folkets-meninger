'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, MessageSquarePlus } from 'lucide-react';
import type { ForumVoteHistoryItem, ForumVoteHistorySummary } from '@/lib/forum/vote-history';
import { routes } from '@/lib/routes';
import { ProfileCard } from '@/components/profile/profile-card';
import { cn } from '@/lib/utils';

export type VoteHistoryItem = ForumVoteHistoryItem;

type VoteFilter = 'all' | 'ja' | 'nei';

type ProfileVoteHistoryProps = {
  items: VoteHistoryItem[];
  summary: ForumVoteHistorySummary;
  loading: boolean;
};

function optionBadgeClass(optionId: string): string {
  if (optionId === 'ja') {
    return 'bg-emerald-100 text-emerald-800 ring-emerald-200';
  }
  if (optionId === 'nei') {
    return 'bg-rose-100 text-rose-800 ring-rose-200';
  }
  return 'bg-gray-100 text-gray-700 ring-gray-200';
}

function VoteSummary({ summary }: { summary: ForumVoteHistorySummary }) {
  const jaPercent = summary.total > 0 ? Math.round((summary.ja / summary.total) * 100) : 0;
  const neiPercent = summary.total > 0 ? Math.round((summary.nei / summary.total) * 100) : 0;

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Svar</p>
        <p className="mt-1 text-2xl font-bold text-gray-900">{summary.total}</p>
      </div>
      <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Ja</p>
        <p className="mt-1 text-2xl font-bold text-emerald-900">{summary.ja}</p>
      </div>
      <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-rose-700">Nei</p>
        <p className="mt-1 text-2xl font-bold text-rose-900">{summary.nei}</p>
      </div>
      <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-indigo-700">Saker</p>
        <p className="mt-1 text-2xl font-bold text-indigo-900">{summary.unique_saker}</p>
      </div>

      {summary.total > 0 ? (
        <div className="sm:col-span-4 rounded-xl border border-gray-200 bg-white px-4 py-4">
          <div className="flex items-center justify-between text-xs font-medium text-gray-600">
            <span>Ja {jaPercent}%</span>
            <span>Nei {neiPercent}%</span>
          </div>
          <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-gray-100">
            <div className="bg-emerald-500" style={{ width: `${jaPercent}%` }} />
            <div className="bg-rose-500" style={{ width: `${neiPercent}%` }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ProfileVoteHistory({ items, summary, loading }: ProfileVoteHistoryProps) {
  const [filter, setFilter] = useState<VoteFilter>('all');

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((item) => item.option_id === filter);
  }, [filter, items]);

  return (
    <ProfileCard
      title="Mine ja/nei-svar"
      description="Svar du har gitt i forumet på meninger og avstemninger."
    >
      {loading ? (
        <p className="text-center py-8 text-gray-500 text-sm">Laster stemmehistorikk…</p>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-gray-500 space-y-4">
          <p className="font-medium text-gray-900">Ingen ja/nei-svar ennå</p>
          <p className="text-sm">
            Del en mening om en sak eller svar på andres «(Jeg mener) …»-avstemninger i forumet.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href={routes.forum}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Gå til forum
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={routes.utforsk}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Utforsk saker
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <VoteSummary summary={summary} />

          <div className="flex flex-wrap gap-2">
            {(['all', 'ja', 'nei'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-sm font-medium border transition-colors',
                  filter === value
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
                )}
              >
                {value === 'all' ? 'Alle' : value === 'ja' ? 'Ja' : 'Nei'}
              </button>
            ))}
          </div>

          <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 overflow-hidden">
            {filteredItems.map((item) => {
              const href = item.stortinget_issue_id
                ? routes.sak(item.stortinget_issue_id)
                : routes.forum;

              return (
                <li key={item.prompt_id}>
                  <Link href={href} className="block px-4 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 line-clamp-2">{item.question}</p>
                        {item.sak_title ? (
                          <p className="mt-1 text-xs text-indigo-600 truncate">{item.sak_title}</p>
                        ) : null}
                      </div>
                      <span
                        className={cn(
                          'inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
                          optionBadgeClass(item.option_id),
                        )}
                      >
                        {item.option_label}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      Svart {new Date(item.voted_at).toLocaleDateString('nb-NO', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/60 px-4 py-4 text-sm text-indigo-950">
            <p className="font-medium">Vil du dele ditt eget standpunkt?</p>
            <p className="mt-1 text-indigo-900/80">
              Start en ny avstemning med «(Jeg mener) …» fra en sak du bryr deg om.
            </p>
            <Link
              href={routes.utforsk}
              className="mt-3 inline-flex items-center gap-1.5 font-medium text-indigo-700 hover:text-indigo-600"
            >
              <MessageSquarePlus className="h-4 w-4" />
              Finn en sak og del mening
            </Link>
          </div>
        </div>
      )}
    </ProfileCard>
  );
}
