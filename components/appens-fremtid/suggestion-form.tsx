'use client';

import { useState, type FormEvent } from 'react';
import { Lightbulb } from 'lucide-react';
import {
  SUGGESTION_AUDIENCES,
  SUGGESTION_BODY_MAX,
  SUGGESTION_BODY_MIN,
  SUGGESTION_CATEGORIES,
  SUGGESTION_TITLE_MAX,
  suggestionAudienceLabel,
  suggestionCategoryLabel,
  type SuggestionAudience,
  type SuggestionCategory,
} from '@/lib/appens-fremtid/constants';

type Status = 'idle' | 'submitting' | 'success';

export function SuggestionForm() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<SuggestionCategory | ''>('');
  const [audience, setAudience] = useState<SuggestionAudience | ''>('');
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
      body: JSON.stringify({ title, body, category, audience }),
    });

    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setStatus('idle');
      setError(data.error || 'Kunne ikke sende forslaget. Prøv igjen.');
      return;
    }

    setStatus('success');
    setTitle('');
    setBody('');
    setCategory('');
    setAudience('');
  };

  if (status === 'success') {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Lightbulb className="h-6 w-6" aria-hidden />
        </div>
        <h2 className="text-xl font-bold text-foreground">Takk. Vi har fått forslaget.</h2>
        <p className="mt-2 text-muted-foreground leading-relaxed">
          Det ligger hos oss først. Hvis vi tar det opp til stemming, vises det her.
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
        <span className="text-sm font-medium text-foreground">Tittel</span>
        <input
          name="title"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={SUGGESTION_TITLE_MAX}
          className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-brand/30"
          placeholder="Hva vil du endre?"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-foreground">Beskrivelse</span>
        <textarea
          name="body"
          required
          rows={5}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={SUGGESTION_BODY_MAX}
          minLength={SUGGESTION_BODY_MIN}
          className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-brand/30"
          placeholder="Hva er problemet, og hva bør appen gjøre i stedet?"
        />
      </label>
      <p className="text-xs text-muted-foreground">
        {body.trim().length}/{SUGGESTION_BODY_MAX} tegn. Minst {SUGGESTION_BODY_MIN} tegn.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">Kategori</span>
          <select
            name="category"
            required
            value={category}
            onChange={(event) => setCategory(event.target.value as SuggestionCategory | '')}
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-brand/30"
          >
            <option value="">Velg kategori</option>
            {SUGGESTION_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {suggestionCategoryLabel(item)}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">Hvem gjelder det?</span>
          <select
            name="audience"
            required
            value={audience}
            onChange={(event) => setAudience(event.target.value as SuggestionAudience | '')}
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-brand/30"
          >
            <option value="">Velg gruppe</option>
            {SUGGESTION_AUDIENCES.map((item) => (
              <option key={item} value={item}>
                {suggestionAudienceLabel(item)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <button
        type="submit"
        disabled={status === 'submitting' || body.trim().length < SUGGESTION_BODY_MIN || title.trim().length < 8}
        className="rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === 'submitting' ? 'Sender…' : 'Send forslag'}
      </button>
    </form>
  );
}
