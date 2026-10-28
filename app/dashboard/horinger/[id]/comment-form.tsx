'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { routes } from '@/lib/routes';
import { loginWithNext } from '@/lib/safe-redirect';

export default function HearingCommentForm({
  stortingetHearingId,
}: {
  stortingetHearingId: string;
}) {
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || submitting) return;
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/hearings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stortinget_hearing_id: stortingetHearingId,
          body: body.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || 'Kunne ikke publisere innspillet. Prøv igjen.');
        return;
      }

      setBody('');
      router.refresh();
    } catch {
      setError('Kunne ikke publisere innspillet. Prøv igjen.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
        <Link href={loginWithNext(routes.horing(stortingetHearingId))} className="inline-flex min-h-11 items-center font-medium text-brand hover:underline">
          Logg inn
        </Link>{' '}
        for å gi innspill.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-4 space-y-3">
      <p className="text-xs text-muted-foreground">
        Innspillet publiseres med ditt navn og er offentlig synlig for andre brukere.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <textarea
        rows={4}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="w-full rounded-lg border border-border bg-background p-3 text-base sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        placeholder="Skriv innspillet ditt…"
        required
      />
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand px-5 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50 sm:w-auto"
      >
        {submitting ? 'Publiserer…' : 'Publiser innspill'}
      </button>
    </form>
  );
}
