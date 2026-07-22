'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import type { ForumPrompt } from '@/lib/forum/prompt-queries';
import { routes } from '@/lib/routes';

type SakMeningPromptCardProps = {
  prompt: ForumPrompt;
};

export function SakMeningPromptCard({ prompt }: SakMeningPromptCardProps) {
  const { user } = useAuth();
  const [selected, setSelected] = useState(prompt.userVote);
  const [options, setOptions] = useState(prompt.options);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const totalVotes = options.reduce((sum, option) => sum + (option.count ?? 0), 0);
  const jaOption = options.find((option) => option.id === 'ja');
  const neiOption = options.find((option) => option.id === 'nei');
  const jaPercent = jaOption?.percent ?? 0;
  const neiPercent = neiOption?.percent ?? 0;

  const handleVote = async (optionId: string) => {
    if (!user || loading || selected) return;
    setLoading(true);
    setError('');

    const res = await fetch('/api/forum/prompt-vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt_id: prompt.id, option_id: optionId }),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Kunne ikke registrere stemme');
      return;
    }

    setSelected(optionId);
    if (Array.isArray(data.options)) {
      setOptions(
        prompt.options.map((option) => {
          const match = data.options.find((item: { id: string }) => item.id === option.id);
          return {
            ...option,
            count: match?.count ?? option.count,
            percent: match?.percent ?? option.percent,
          };
        }),
      );
    }
  };

  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <p className="text-base font-semibold leading-relaxed text-foreground">{prompt.question}</p>

      {!user ? (
        <p className="mt-4 text-sm text-muted-foreground">
          <Link href={routes.login} className="font-medium text-indigo-600 hover:text-indigo-500">
            Logg inn
          </Link>{' '}
          for å svare ja eller nei.
        </p>
      ) : selected ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Du svarte <span className="font-semibold text-foreground">{selected === 'ja' ? 'Ja' : 'Nei'}</span>.
          </p>
          <div className="flex h-2 overflow-hidden rounded-full bg-muted">
            <div className="bg-emerald-500" style={{ width: `${jaPercent}%` }} />
            <div className="bg-rose-500" style={{ width: `${neiPercent}%` }} />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{jaPercent}% Ja</span>
            <span>{totalVotes} stemmer</span>
            <span>{neiPercent}% Nei</span>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleVote('ja')}
            className="inline-flex min-w-[96px] items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ja'}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleVote('nei')}
            className="inline-flex min-w-[96px] items-center justify-center rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Nei'}
          </button>
        </div>
      )}

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </article>
  );
}
