import { redditCommunityName } from '@/lib/reddit';

const MESSAGES = {
  joined: `Du er med i r/${redditCommunityName()}. Bruk Del når du vil poste saken der.`,
  denied: 'Reddit-innlogging ble avbrutt. Du kan prøve igjen når du vil.',
  error:
    'Vi fikk ikke meldt deg inn i Reddit-gruppen automatisk. Prøv igjen, eller åpne gruppen manuelt.',
} as const;

type RedditJoinStatus = keyof typeof MESSAGES;

function parseRedditJoinStatus(value: string | string[] | undefined): RedditJoinStatus | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'joined' || raw === 'denied' || raw === 'error') return raw;
  return null;
}

export function RedditJoinBanner({ status }: { status?: string | string[] | null }) {
  const parsed = parseRedditJoinStatus(status ?? undefined);
  if (!parsed) return null;

  const tone =
    parsed === 'joined'
      ? 'border-brand/20 bg-brand/5 text-foreground'
      : 'border-border bg-muted/50 text-muted-foreground';

  return (
    <p className={`rounded-xl border px-4 py-3 text-sm ${tone}`} role="status">
      {MESSAGES[parsed]}
    </p>
  );
}
