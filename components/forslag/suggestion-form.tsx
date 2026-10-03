'use client';

import { useState, type FormEvent } from 'react';
import { Lightbulb } from 'lucide-react';
import { SUGGESTION_BODY_MAX, SUGGESTION_BODY_MIN } from '@/lib/suggestions/constants';

type Status = 'idle' | 'submitting' | 'success';

export function SuggestionForm() {
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (status === 'submitting') return;

    setStatus('submitting');
    setError('');

    const res = await fetch('/api/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });

    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setStatus('idle');
      setError(data.error || 'Kunne ikke sende forslaget. Prøv igjen.');
      return;
    }

    setStatus('success');
    setBody('');
  };

  if (status === 'success') {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Lightbulb className="h-6 w-6" aria-hidden />
        </div>
        <h2 className="text-xl font-bold text-foreground">Takk for forslaget</h2>
        <p className="mt-2 text-muted-foreground leading-relaxed">
          Vi har mottatt forslaget ditt og bruker tilbakemeldinger til å forbedre Folkets Stemme.
        </p>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="mt-6 inline-flex items-center justify-center rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
          Send et nytt forslag
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-border bg-card p-6"
      noValidate
    >
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-foreground">Ditt forslag</span>
        <textarea
          name="body"
          required
          rows={6}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={SUGGESTION_BODY_MAX}
          minLength={SUGGESTION_BODY_MIN}
          className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-brand/30"
          placeholder="Beskriv forslaget ditt kort…"
        />
      </label>
      <p className="text-xs text-muted-foreground">
        {body.trim().length}/{SUGGESTION_BODY_MAX} tegn. Minst {SUGGESTION_BODY_MIN} tegn.
      </p>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <button
        type="submit"
        disabled={status === 'submitting' || body.trim().length < SUGGESTION_BODY_MIN}
        className="rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === 'submitting' ? 'Sender…' : 'Send forslag'}
      </button>
    </form>
  );
}
