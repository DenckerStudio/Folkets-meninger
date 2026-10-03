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
  stance_count?: number;
  vote_count?: number;
  party_alignment_available?: boolean;
  error?: string;
};

export function ValgomatPanel() {
  const [scores, setScores] = useState<PartyScore[]>([]);
  const [stanceCount, setStanceCount] = useState(0);
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
        setStanceCount(data.stance_count ?? data.vote_count ?? 0);
        setAlignmentAvailable(data.party_alignment_available === true);
        setError(null);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setScores([]);
        setStanceCount(0);
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
    return <p className="text-sm text-muted-foreground py-6 text-center">Beregner partiforslag…</p>;
  }

  if (error) {
    return (
      <div className="text-center py-8 space-y-2">
        <p className="text-sm text-destructive">{error}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setError(null);
            window.location.reload();
          }}
          className="text-sm text-brand font-medium hover:text-brand/80"
        >
          Prøv igjen
        </button>
      </div>
    );
  }

  if (stanceCount === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">
          Marker holdning (enig eller uenig) på minst noen saker for å se din Valgomat.
        </p>
        <Link href={routes.utforsk} className="mt-4 inline-block text-brand font-medium hover:text-brand/80">
          Utforsk saker →
        </Link>
      </div>
    );
  }

  if (!alignmentAvailable || scores.length === 0) {
    return (
      <div className="space-y-4 py-4">
        <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 text-sm text-foreground">
          Du har markert <strong>{stanceCount}</strong>{' '}
          {stanceCount === 1 ? 'holdning' : 'holdninger'} (enig/uenig). Partisammenligning er klar i
          produktet, men slått av inntil vi har ekte stemmedata per parti fra Stortinget — vi viser
          ingen fiktive prosenter.
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Fortsett å markere holdninger. Når partidata er koblet, dukker Valgomaten opp automatisk her.
        </p>
        <Link
          href={routes.utforsk}
          className="block text-center text-sm font-medium text-brand hover:text-brand/80"
        >
          Utforsk flere saker →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-brand/5 border border-brand/20 rounded-xl p-4 text-sm text-foreground">
        Basert på {stanceCount} holdninger sammenlignet med partivurdering per sak.
      </div>
      <ul className="space-y-3">
        {scores.map((row) => (
          <li key={row.party}>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-foreground">{row.party}</span>
              <span className="text-muted-foreground">{row.agreement_percent}% enighet</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-brand rounded-full"
                style={{ width: `${row.agreement_percent}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
