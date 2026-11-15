'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ValgomatConsentPrompt } from '@/components/valgomat/valgomat-consent-prompt';
import { routes } from '@/lib/routes';
import { parseValgomatApiResponse } from '@/lib/valgomat/api-client';
import { VALGOMAT_SMALL_SAMPLE_COMPARABLE } from '@/lib/valgomat/alignment';
import type { ValgomatPayload } from '@/lib/valgomat/types';

type FetchState =
  | { status: 'loading' }
  | { status: 'consent_required' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: ValgomatPayload };

export function ValgomatPanel() {
  const [state, setState] = useState<FetchState>({ status: 'loading' });
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/user/valgomat', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (res) => {
        const data = (await res.json()) as ValgomatPayload & { error?: string; code?: string };
        const parsed = parseValgomatApiResponse(res.status, data);
        if (cancelled) return;
        if (parsed.kind === 'consent_required') {
          setState({ status: 'consent_required' });
          return;
        }
        if (parsed.kind === 'error') {
          setState({ status: 'error', message: parsed.message });
          return;
        }
        setState({ status: 'ready', data: parsed.data });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ status: 'error', message: 'Kunne ikke laste Valgomat' });
      });

    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  const reload = () => {
    setState({ status: 'loading' });
    setReloadNonce((n) => n + 1);
  };

  if (state.status === 'loading') {
    return (
      <p role="status" className="py-6 text-center text-sm text-muted-foreground">
        Laster…
      </p>
    );
  }

  if (state.status === 'consent_required') {
    return <ValgomatConsentPrompt compact onConsented={reload} />;
  }

  if (state.status === 'error') {
    return (
      <ErrorRetryBlock message={state.message} onRetry={reload} />
    );
  }

  const { data } = state;

  if (data.stance_count === 0) {
    return (
      <div className="space-y-4 py-4 text-center">
        <p className="text-sm text-muted-foreground">
          Marker holdning (enig eller uenig) på saker for å se hjertesaker og partisamsvar.
        </p>
        <Link
          href={routes.utforsk}
          className="inline-flex min-h-11 items-center text-sm font-medium text-brand hover:text-brand/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
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
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
              Lite grunnlag (færre enn {VALGOMAT_SMALL_SAMPLE_COMPARABLE} sammenlignbare saker)
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Ingen sammenlignbare partivoteringer ennå for sakene du har markert.</p>
          <Link
            href={routes.utforsk}
            className="inline-flex min-h-11 items-center font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            Utforsk saker →
          </Link>
        </div>
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

function ErrorRetryBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="space-y-2 py-6 text-center">
      <p className="text-sm text-destructive">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-11 px-3 text-sm font-medium text-brand hover:text-brand/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        Prøv igjen
      </button>
    </div>
  );
}