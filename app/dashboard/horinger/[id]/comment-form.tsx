'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { routes } from '@/lib/routes';

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

    const res = await fetch('/api/hearings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stortinget_hearing_id: stortingetHearingId,
        body: body.trim(),
      }),
    });

    const data = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error || 'Kunne ikke publisere');
      return;
    }

    setBody('');
    router.refresh();
  };

  if (!user) {
    return (
      <p className="text-sm text-center text-muted-foreground py-4">
        <Link href={routes.login} className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
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
        className="w-full border border-border rounded-lg p-3 text-sm"
        placeholder="Skriv innspillet ditt…"
        required
      />
      <button
        type="submit"
        disabled={submitting}
        className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
      >
        {submitting ? 'Publiserer…' : 'Publiser innspill'}
      </button>
    </form>
  );
}
