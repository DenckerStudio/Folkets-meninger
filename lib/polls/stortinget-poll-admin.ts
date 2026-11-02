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
  closesAt: ClosesAtApplyAction;
};

export type ClosesAtApplyAction =
  | { action: 'skip' }
  | { action: 'clear' }
  | { action: 'set'; iso: string };

export type PublishStortingetPollDeps = {
  ensureStortingetPoll: (input: {
    issueId: string;
    title: string;
    neutralSummary?: string;
    sourceUrls?: PollSourceUrl[];
  }) => Promise<string | null>;
  setPollClosesAt: (pollId: string, closesAtIso: string | null) => Promise<void>;
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

export function parseNorwegianDate(raw: string): { day: number; month: number; year: number } | null {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(raw.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { day, month, year };
}

export function parseNorwegianTime(raw: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export function formatNorwegianDateParts(day: number, month: number, year: number): string {
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
}

export function formatNorwegianTimeParts(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Wire format YYYY-MM-DDTHH:mm (Oslo wall clock) for internal comparison. */
export function norwegianClosesAtToWire(dateRaw: string, timeRaw: string): string | null {
  const date = normalizePublishStortingetPollText(dateRaw);
  const time = normalizePublishStortingetPollText(timeRaw);
  if (!date && !time) return null;
  if (!date || !time) return null;
  const parsedDate = parseNorwegianDate(date);
  const parsedTime = parseNorwegianTime(time);
  if (!parsedDate || !parsedTime) return null;
  const wire = `${String(parsedDate.year).padStart(4, '0')}-${String(parsedDate.month).padStart(2, '0')}-${String(parsedDate.day).padStart(2, '0')}T${formatNorwegianTimeParts(parsedTime.hour, parsedTime.minute)}`;
  if (!osloLocalDateTimeToUtcDate(wire)) return null;
  return wire;
}

export function utcIsoToNorwegianClosesAtFields(iso: string): { date: string; time: string } {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return { date: '', time: '' };
  }
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
    Number(parts.find((part) => part.type === type)?.value ?? Number.NaN);
  return {
    date: formatNorwegianDateParts(read('day'), read('month'), read('year')),
    time: formatNorwegianTimeParts(read('hour'), read('minute')),
  };
}

export function isPollClosesAtPast(iso: string | null | undefined, now: Date = new Date()): boolean {
  if (!iso) return false;
  const ms = new Date(iso).getTime();
  return !Number.isNaN(ms) && ms <= now.getTime();
}

export function validateClosesAtForPublish(
  raw: Record<string, unknown>,
  now: Date = new Date(),
): { ok: true; closesAt: ClosesAtApplyAction } | { ok: false; error: string } {
  const isUpdate = raw.isUpdate === true;
  const initialWire =
    typeof raw.initialClosesAtWire === 'string' && raw.initialClosesAtWire.trim()
      ? raw.initialClosesAtWire.trim()
      : null;
  const dateRaw = normalizePublishStortingetPollText(raw.closesAtDate);
  const timeRaw = normalizePublishStortingetPollText(raw.closesAtTime);

  if (!dateRaw && !timeRaw) {
    if (isUpdate && initialWire) {
      return { ok: true, closesAt: { action: 'clear' } };
    }
    return { ok: true, closesAt: { action: 'skip' } };
  }

  if (!dateRaw || !timeRaw) {
    return {
      ok: false,
      error: 'Fyll inn både dato (dd.mm.åååå) og klokkeslett (tt:mm), eller la begge stå tomme.',
    };
  }

  const wire = norwegianClosesAtToWire(dateRaw, timeRaw);
  if (!wire) {
    return { ok: false, error: 'Ugyldig sluttidspunkt.' };
  }

  if (initialWire && wire === initialWire) {
    return { ok: true, closesAt: { action: 'skip' } };
  }

  const parsed = osloLocalDateTimeToUtcDate(wire);
  if (!parsed) {
    return { ok: false, error: 'Ugyldig sluttidspunkt.' };
  }
  if (parsed.getTime() <= now.getTime()) {
    return {
      ok: false,
      error:
        'Sluttidspunktet må ligge i fremtiden. Velg en senere dato og klokkeslett (Europe/Oslo).',
    };
  }
  return { ok: true, closesAt: { action: 'set', iso: parsed.toISOString() } };
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

  const closesAtParsed = validateClosesAtForPublish(raw, now);
  if (!closesAtParsed.ok) {
    return { ok: false, error: closesAtParsed.error };
  }

  return {
    ok: true,
    value: {
      issueId,
      title,
      neutralSummary,
      closesAt: closesAtParsed.closesAt,
    },
  };
}

/** datetime-local wire YYYY-MM-DDTHH:mm interpreted as wall time in Europe/Oslo → UTC Date. */
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

/** @deprecated Prefer utcIsoToNorwegianClosesAtFields in UI. */
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

export function validateStortingetPollAdminForm(
  raw: Record<string, unknown>,
  now: Date = new Date(),
): { ok: true } | { ok: false; error: string } {
  const result = validatePublishStortingetPollInput(raw, now);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true };
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

  const { issueId, title, neutralSummary, closesAt } = validated.value;
  const pollId = await deps.ensureStortingetPoll({
    issueId,
    title,
    neutralSummary,
    sourceUrls: buildStortingetPollSourceUrls(issueId),
  });

  if (!pollId) {
    return { ok: false, error: 'Kunne ikke publisere avstemningen. Prøv igjen senere.' };
  }

  try {
    switch (closesAt.action) {
      case 'skip':
        break;
      case 'clear':
        await deps.setPollClosesAt(pollId, null);
        break;
      case 'set':
        await deps.setPollClosesAt(pollId, closesAt.iso);
        break;
      default: {
        const _never: never = closesAt;
        return _never;
      }
    }
  } catch {
    return { ok: false, error: 'Avstemningen ble lagret, men sluttidspunktet ble ikke oppdatert.' };
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
