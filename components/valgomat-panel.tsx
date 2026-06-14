'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { routes } from '@/lib/routes';

type PartyScore = {
  party: string;
  agreement_percent: number;
  compared_issues: number;
};

type ValgomatResponse = {
  scores?: PartyScore[];
  vote_count?: number;
  party_alignment_available?: boolean;
  error?: string;
};

export function ValgomatPanel() {
  const [scores, setScores] = useState<PartyScore[]>([]);
  const [voteCount, setVoteCount] = useState(0);
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
        setAlignmentAvailable(data.party_alignment_available === true);
        setError(null);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setScores([]);
        setVoteCount(0);
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
    return <p className="text-sm text-gray-500 py-6 text-center">Beregner partiforslag…</p>;
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

  if (voteCount === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Du må stemme på minst noen saker for å se din Valgomat.</p>
        <Link href={routes.utforsk} className="mt-4 inline-block text-indigo-600 font-medium hover:text-indigo-500">
          Utforsk saker →
        </Link>
      </div>
    );
  }

  if (!alignmentAvailable || scores.length === 0) {
    return (
      <div className="space-y-4 py-4">
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
          Du har stemt på <strong>{voteCount}</strong>{' '}
          {voteCount === 1 ? 'sak' : 'saker'}. Partisammenligning (hvilke partier du stemmer mest likt)
          kommer når vi har koblet stemmene dine mot Stortingets partivurderinger per sak.
        </div>
        <p className="text-sm text-gray-500 text-center">
          Ingen fiktive prosenter vises — bare ekte data når sammenligningen er klar.
        </p>
        <Link
          href={routes.utforsk}
          className="block text-center text-indigo-600 font-medium hover:text-indigo-500 text-sm"
        >
          Stem på flere saker →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-900">
        Basert på {voteCount} stemmer sammenlignet med partivurdering per sak.
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
