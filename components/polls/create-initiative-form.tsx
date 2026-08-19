'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { routes } from '@/lib/routes';
import { CITIZEN_INITIATIVE_DEFAULT_THRESHOLD } from '@/lib/polls/norway-counties';

export function CreateInitiativeForm() {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user) {
      router.push(`${routes.login}?next=${encodeURIComponent(routes.initiativ)}`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/initiatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          title: title.trim(),
          body: body.trim(),
          supportThreshold: CITIZEN_INITIATIVE_DEFAULT_THRESHOLD,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Kunne ikke opprette initiativ');
        return;
      }
      router.push(routes.initiative(data.initiativeId));
      router.refresh();
    } catch {
      setError('En feil oppstod');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-base font-semibold text-foreground">Foreslå nytt borgerinitiativ</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Tittel og begrunnelse. Når {CITIZEN_INITIATIVE_DEFAULT_THRESHOLD} innbyggere støtter forslaget, kan det
        bli en nasjonal avstemning (Ja/Nei/Blank).
      </p>
      <div className="mt-4 space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tittel på initiativet"
          maxLength={200}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-brand/30"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Begrunnelse (minst 20 tegn)"
          rows={5}
          maxLength={10000}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-brand/30"
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <button
          type="button"
          onClick={submit}
          disabled={busy || title.trim().length < 5 || body.trim().length < 20}
          className="rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Oppretter…' : 'Opprett initiativ'}
        </button>
      </div>
    </div>
  );
}
