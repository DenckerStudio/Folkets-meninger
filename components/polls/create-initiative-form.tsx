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
      router.push(routes.login);
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
    <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-sky-50/40 p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">Foreslå nytt borgerinitiativ</h2>
      <p className="mt-1 text-sm text-gray-600">
        Oppretter samtidig en forumtråd. Standard terskel: {CITIZEN_INITIATIVE_DEFAULT_THRESHOLD}{' '}
        støtteerklæringer.
      </p>
      <div className="mt-4 space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tittel på initiativet"
          maxLength={200}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none ring-[#00205b]/20 focus:ring-2"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Nøytral eller argumenterende begrunnelse (minst 20 tegn)"
          rows={5}
          maxLength={10000}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none ring-[#00205b]/20 focus:ring-2"
        />
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        <button
          type="button"
          onClick={submit}
          disabled={busy || title.trim().length < 5 || body.trim().length < 20}
          className="rounded-lg bg-[#00205b] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#001a4a] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Oppretter…' : 'Opprett initiativ'}
        </button>
      </div>
    </div>
  );
}
