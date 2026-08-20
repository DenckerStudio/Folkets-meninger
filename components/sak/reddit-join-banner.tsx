'use client';

import { useSearchParams } from 'next/navigation';
import { redditCommunityName } from '@/lib/reddit';

const MESSAGES: Record<string, string> = {
  joined: `Du er med i r/${redditCommunityName()}. Du kan nå diskutere saken der.`,
  denied: 'Reddit-innlogging ble avbrutt. Du kan prøve igjen når du vil.',
  error: 'Vi fikk ikke meldt deg inn i Reddit-gruppen automatisk. Prøv igjen, eller åpne gruppen manuelt.',
};

export function RedditJoinBanner() {
  const searchParams = useSearchParams();
  const status = searchParams.get('reddit');
  const message = status ? MESSAGES[status] : null;
  if (!message) return null;

  const tone =
    status === 'joined'
      ? 'border-brand/20 bg-brand/5 text-foreground'
      : 'border-border bg-muted/50 text-muted-foreground';

  return (
    <p className={`rounded-xl border px-4 py-3 text-sm ${tone}`} role="status">
      {message}
    </p>
  );
}
