'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { routes } from '@/lib/routes';
import type { ValgomatPayload } from '@/lib/valgomat/types';
import { VALGOMAT_SMALL_SAMPLE_COMPARABLE } from '@/lib/valgomat/alignment';

type FetchState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: ValgomatPayload };

export function ValgomatPanel() {
  const [state, setState] = useState<FetchState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    fetch('/api/user/valgomat', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (res) => {
        const data = (await res.json()) as ValgomatPayload & { error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? 'Kunne ikke laste Valgomat');
        }
        if (cancelled) return;
        setState({ status: 'ready', data });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setState({ status: 'error', message: err.message || 'Kunne ikke laste Valgomat' });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') {
    return <p className="py-6 text-center text-sm text-muted-foreground">Laster…</p>;
  }

  if (state.status === 'error') {
    return (
      <ErrorRetryBlock message={state.message} />
    );
  }

  const { data } = state;

  if (data.stance_count === 0) {
    return (
      <div className="space-y-4 py-4 text-center">
        <p className="text-muted-foreground text-sm">
          Marker holdning (enig eller uenig) på saker for å se hjertesaker og partisamsvar.
        </p>
        <Link
          href={routes.utforsk}
          className="inline-flex min-h-11 items-center text-sm font-medium text-brand hover:text-brand/80"
        >
          Utforsk saker →
        </Link>
      </div>
    );
  }

  const top = data.partisamsvar[0];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {data.stance_count} {data.stance_count === 1 ? 'holdning' : 'holdninger'} ·{' '}
        {data.comparable_issue_count}{' '}
        {data.comparable_issue_count === 1 ? 'sak' : 'saker'} med partivotering
      </p>
      {top ? (
        <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 text-sm">
          <p className="font-medium text-foreground">{top.party_name}</p>
          <p className="text-muted-foreground">
            {top.matching} av {top.comparable} saker stemmer overens
            {top.agreement_percent !== null ? ` (${top.agreement_percent} %)` : null}
          </p>
          {top.small_sample ? (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
              Lite grunnlag (færre enn {VALGOMAT_SMALL_SAMPLE_COMPARABLE} sammenlignbare saker)
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Ingen sammenlignbare partivoteringer ennå for sakene du har markert.
        </p>
      )}
      <Link
        href={routes.valgomat}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-border bg-card text-sm font-medium text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        Åpne Valgomat →
      </Link>
    </div>
  );
}

function ErrorRetryBlock({ message }: { message: string }) {
  return (
    <div className="space-y-2 py-6 text-center">
      <p className="text-sm text-destructive">{message}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="text-sm font-medium text-brand hover:text-brand/80 min-h-11 px-3"
      >
        Prøv igjen
      </button>
    </div>
  );
}