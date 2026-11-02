import type { PollSourceUrl } from '@/lib/polls/types';
import { getStortingetSakUrl } from '@/lib/stortinget-horinger';

export const STORTINGET_POLL_ADMIN_TIMEZONE = 'Europe/Oslo';
/** Same cap as POLL_OG_TITLE_RAW_MAX in lib/polls/share-og.tsx */
export const STORTINGET_POLL_TITLE_MAX = 130;
export const STORTINGET_POLL_NEUTRAL_SUMMARY_MAX = 2000;

export type PublishStortingetPollInput = {
  issueId: string;
  title: string;
  neutralSummary: string;
  closesAtIso: string | null;
};

export type PublishStortingetPollDeps = {
  ensureStortingetPoll: (input: {
    issueId: string;
    title: string;
    neutralSummary?: string;
    sourceUrls?: PollSourceUrl[];
  }) => Promise<string | null>;
  setPollClosesAt: (pollId: string, closesAtIso: string) => Promise<void>;
};

export function buildStortingetPollSourceUrls(issueId: string): PollSourceUrl[] {
  const trimmed = issueId.trim();
  return [
    {
      label: 'Stortinget',
      url: getStortingetSakUrl(trimmed),
    },
  ];
}

export function normalizePublishStortingetPollText(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim();
}

export function validatePublishStortingetPollInput(
  raw: Record<string, unknown>,
  now: Date = new Date(),
):
  | { ok: true; value: PublishStortingetPollInput }
  | { ok: false; error: string } {
  const issueId = normalizePublishStortingetPollText(raw.issueId);
  if (!issueId) {
    return { ok: false, error: 'Mangler sak.' };
  }

  const title = normalizePublishStortingetPollText(raw.title);
  if (!title) {
    return { ok: false, error: 'Tittel er påkrevd.' };
  }
  if (title.length > STORTINGET_POLL_TITLE_MAX) {
    return {
      ok: false,
      error: `Tittelen kan være maks ${STORTINGET_POLL_TITLE_MAX} tegn.`,
    };
  }

  const neutralSummary = normalizePublishStortingetPollText(raw.neutralSummary);
  if (neutralSummary.length > STORTINGET_POLL_NEUTRAL_SUMMARY_MAX) {
    return {
      ok: false,
      error: `Nøytral ingress kan være maks ${STORTINGET_POLL_NEUTRAL_SUMMARY_MAX} tegn.`,
    };
  }

  const closesAtParsed = parseFutureClosesAtOslo(raw.closesAtOslo, now);
  if ('error' in closesAtParsed) {
    return { ok: false, error: closesAtParsed.error };
  }

  return {
    ok: true,
    value: {
      issueId,
      title,
      neutralSummary,
      closesAtIso: closesAtParsed.closesAt,
    },
  };
}

export function parseFutureClosesAtOslo(
  raw: unknown,
  now: Date = new Date(),
): { closesAt: string | null } | { error: string } {
  if (raw == null || (typeof raw === 'string' && !raw.trim())) {
    return { closesAt: null };
  }
  if (typeof raw !== 'string') {
    return { error: 'Ugyldig sluttidspunkt.' };
  }
  const parsed = osloLocalDateTimeToUtcDate(raw.trim());
  if (!parsed) {
    return { error: 'Ugyldig sluttidspunkt.' };
  }
  if (parsed.getTime() <= now.getTime()) {
    return { error: 'Sluttidspunkt må ligge i fremtiden.' };
  }
  return { closesAt: parsed.toISOString() };
}

/** datetime-local value interpreted as wall time in Europe/Oslo → UTC Date. */
export function osloLocalDateTimeToUtcDate(local: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (
    !Number.isFinite(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }

  let guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  for (let attempt = 0; attempt < 5; attempt++) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: STORTINGET_POLL_ADMIN_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(guess);
    const read = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value ?? Number.NaN);
    const y = read('year');
    const mo = read('month');
    const d = read('day');
    const h = read('hour');
    const mi = read('minute');
    const diffMinutes =
      (year - y) * 525_600 +
      (month - mo) * 43_200 +
      (day - d) * 1_440 +
      (hour - h) * 60 +
      (minute - mi);
    if (diffMinutes === 0) return guess;
    guess = new Date(guess.getTime() + diffMinutes * 60_000);
  }
  return guess;
}

export function utcIsoToOsloLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: STORTINGET_POLL_ADMIN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${read('year')}-${read('month')}-${read('day')}T${read('hour')}:${read('minute')}`;
}

export async function publishStortingetPollForAdmin(
  raw: Record<string, unknown>,
  deps: PublishStortingetPollDeps,
  now: Date = new Date(),
): Promise<{ ok: true; pollId: string } | { ok: false; error: string }> {
  const validated = validatePublishStortingetPollInput(raw, now);
  if (!validated.ok) {
    return { ok: false, error: validated.error };
  }

  const { issueId, title, neutralSummary, closesAtIso } = validated.value;
  const pollId = await deps.ensureStortingetPoll({
    issueId,
    title,
    neutralSummary,
    sourceUrls: buildStortingetPollSourceUrls(issueId),
  });

  if (!pollId) {
    return { ok: false, error: 'Kunne ikke publisere avstemningen. Prøv igjen senere.' };
  }

  if (closesAtIso) {
    try {
      await deps.setPollClosesAt(pollId, closesAtIso);
    } catch {
      return { ok: false, error: 'Avstemningen ble opprettet, men sluttidspunktet ble ikke lagret.' };
    }
  }

  return { ok: true, pollId };
}

export async function runPublishStortingetPollAdminAction(
  raw: Record<string, unknown>,
  context: {
    isAdmin: boolean;
    deps: PublishStortingetPollDeps;
    now?: Date;
  },
): Promise<{ ok: true; pollId: string } | { ok: false; error: string }> {
  if (!context.isAdmin) {
    return { ok: false, error: 'Ingen tilgang' };
  }
  return publishStortingetPollForAdmin(raw, context.deps, context.now);
}
