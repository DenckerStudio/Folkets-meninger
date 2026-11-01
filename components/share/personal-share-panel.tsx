'use client';

import { useState } from 'react';

type PersonalSharePanelProps = {
  pollId: string;
  origin: string;
};

function absoluteShareUrl(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, '')}/l/${code}`;
}

export function PersonalSharePanel({ pollId, origin }: PersonalSharePanelProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);

  async function createLink() {
    setBusy(true);
    setError('');
    setCopied(false);
    try {
      const response = await fetch('/api/share-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetKind: 'poll', targetId: pollId }),
      });
      const data = (await response.json().catch(() => null)) as { link?: { code?: unknown } } | null;
      const code = data?.link?.code;
      if (!response.ok || typeof code !== 'string' || !code) {
        setError('Kunne ikke lage delingslenke');
        return;
      }
      setUrl(absoluteShareUrl(origin, code));
    } catch {
      setError('Kunne ikke lage delingslenke');
    } finally {
      setBusy(false);
    }
  }

  async function copyUrl() {
    setError('');
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
      setError('Kunne ikke kopiere automatisk. Kopier lenken manuelt.');
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4" lang="nb">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">Din delingslenke</h2>
        <p className="text-sm text-muted-foreground">
          Lenken er knyttet til kontoen din, slik at vi kan se hvor mange som åpner den. Vi lagrer
          ikke hvem som klikker.
        </p>
      </div>
      {url ? (
        <div className="space-y-2">
          <p className="break-all rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
            {url}
          </p>
          <button
            type="button"
            onClick={() => {
              void copyUrl();
            }}
            className="inline-flex items-center rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            Kopier
          </button>
          {copied ? (
            <p className="text-sm text-muted-foreground" role="status">
              Lenken er kopiert
            </p>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void createLink();
          }}
          className="inline-flex items-center rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:opacity-90 disabled:opacity-60"
        >
          {busy ? 'Lager lenke…' : 'Lag lenke'}
        </button>
      )}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
