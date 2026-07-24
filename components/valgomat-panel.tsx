'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { routes } from '@/lib/routes';
import type { ForumVoteHistorySummary } from '@/lib/forum/vote-history';
import type { ForumVoteInsights } from '@/lib/forum/vote-history-service';

type PartyScore = {
  party: string;
  agreement_percent: number;
  compared_issues: number;
};

type ValgomatResponse = {
  scores?: PartyScore[];
  vote_count?: number;
  party_alignment_available?: boolean;
  insights?: ForumVoteInsights;
  error?: string;
};

function InsightStat({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${className ?? 'border-gray-200 bg-gray-50'}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function VotePattern({ summary }: { summary: ForumVoteHistorySummary }) {
  const jaPercent = summary.total > 0 ? Math.round((summary.ja / summary.total) * 100) : 0;
  const neiPercent = summary.total > 0 ? Math.round((summary.nei / summary.total) * 100) : 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h4 className="text-sm font-semibold text-gray-900">Ditt stemmemønster</h4>
      <p className="mt-1 text-sm text-gray-600">
        Fordeling av ja og nei i forumet — ikke partitilhørighet.
      </p>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-gray-100">
        <div className="bg-emerald-500" style={{ width: `${jaPercent}%` }} />
        <div className="bg-rose-500" style={{ width: `${neiPercent}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs font-medium text-gray-600">
        <span>Ja {jaPercent}%</span>
        <span>{summary.total} svar</span>
        <span>Nei {neiPercent}%</span>
      </div>
    </div>
  );
}

export function ValgomatPanel() {
  const [scores, setScores] = useState<PartyScore[]>([]);
  const [voteCount, setVoteCount] = useState(0);
  const [insights, setInsights] = useState<ForumVoteInsights | null>(null);
  const [alignmentAvailable, setAlignmentAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/user/valgomat', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (res) => {
        const data = (await res.json()) as ValgomatResponse;
        if (!res.ok) {
          throw new Error(data.error ?? 'Kunne ikke laste Valgomat');
        }
        if (cancelled) return;
        setScores(data.scores ?? []);
        setVoteCount(data.vote_count ?? 0);
        setInsights(data.insights ?? null);
        setAlignmentAvailable(data.party_alignment_available === true);
        setError(null);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setScores([]);
        setVoteCount(0);
        setInsights(null);
        setError(err.message || 'Kunne ikke laste Valgomat');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-gray-500 py-6 text-center">Beregner profil…</p>;
  }

  if (error) {
    return (
      <div className="text-center py-8 space-y-2">
        <p className="text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setError(null);
            window.location.reload();
          }}
          className="text-sm text-indigo-600 font-medium hover:text-indigo-500"
        >
          Prøv igjen
        </button>
      </div>
    );
  }

  if (voteCount === 0 || !insights) {
    return (
      <div className="text-center py-8 space-y-4">
        <p className="text-gray-600">
          Svar på minst én ja/nei-avstemning i forumet for å se engasjement og stemmemønster her.
        </p>
        <Link
          href={routes.forum}
          className="inline-block text-indigo-600 font-medium hover:text-indigo-500"
        >
          Gå til forumet →
        </Link>
      </div>
    );
  }

  const { summary, top_topics: topTopics, recent } = insights;

  if (!alignmentAvailable || scores.length === 0) {
    return (
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <InsightStat label="Ja/nei-svar" value={summary.total} />
          <InsightStat
            label="Saker"
            value={summary.unique_saker}
            className="border-indigo-100 bg-indigo-50"
          />
          <InsightStat
            label="Andre svar"
            value={summary.other}
            className="border-gray-200 bg-gray-50"
          />
        </div>

        <VotePattern summary={summary} />

        {topTopics.length > 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h4 className="text-sm font-semibold text-gray-900">Temaer du har engasjert deg med</h4>
            <div className="mt-3 flex flex-wrap gap-2">
              {topTopics.map((topic) => (
                <span
                  key={topic.tag}
                  className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-800 ring-1 ring-indigo-100"
                >
                  {topic.tag}
                  <span className="ml-1.5 text-indigo-500">{topic.count}</span>
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {recent.length > 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h4 className="text-sm font-semibold text-gray-900">Siste svar</h4>
            <ul className="mt-3 space-y-3">
              {recent.map((item) => (
                <li key={item.prompt_id} className="text-sm">
                  <p className="font-medium text-gray-900 line-clamp-2">{item.question}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Du svarte <span className="font-semibold text-gray-700">{item.option_label}</span>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
          Partisammenligning kommer når vi kan koble dine forum-svar mot Stortingets partivurderinger per
          sak. Inntil da viser Valgomat ditt engasjement og stemmemønster — uten fiktive prosenter.
        </div>

        <Link
          href={routes.forum}
          className="block text-center text-indigo-600 font-medium hover:text-indigo-500 text-sm"
        >
          Svar på flere avstemninger i forumet →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-900">
        Basert på {voteCount} ja/nei-svar sammenlignet med partivurdering per sak.
      </div>
      <ul className="space-y-3">
        {scores.map((row) => (
          <li key={row.party}>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-gray-900">{row.party}</span>
              <span className="text-gray-600">{row.agreement_percent}% enighet</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full"
                style={{ width: `${row.agreement_percent}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
