import { KALENDER_TIMEZONE } from '@/lib/kalender-events';
import { getServiceSupabase } from '@/lib/supabase';
import { formatVotingDaysLeftLabel, getLastPastVoteEventDate } from '@/lib/sak-voting-window';
import { routes } from '@/lib/routes';
import type { StortingetSakDetail } from '@/lib/stortinget';
import type { StortingetHoring } from '@/lib/stortinget-horinger';
import {
  compareHoringerByInnspillDeadline,
  fetchStortingetHoringer,
  formatDateNb,
  formatHoringInnspillFristLabel,
  getHoringInnspillDeadline,
  getHoringTitle,
  isHoringOpen,
  parseStortingetDate,
} from '@/lib/stortinget-horinger';
import type { StortingetSporsmal } from '@/lib/stortinget-sporsmal';
import { getSporsmalListe } from '@/lib/stortinget';

// Internal constant used for building the weekly overview window
const WEEKLY_OVERVIEW_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const WEEKLY_OVERVIEW_LOOKAHEAD_MS = 7 * 24 * 60 * 60 * 1000;
export const WEEKLY_OVERVIEW_HEARING_DEADLINE_DAYS = 7;
export const WEEKLY_OVERVIEW_LIST_LIMIT = 12;

export type WeeklyOverviewWindow = {
  now: Date;
  pastStart: Date;
  futureEnd: Date;
  /** Full bokmål-beskrivelse for intro og digest. */
  label: string;
  pastRangeLabel: string;
  futureRangeLabel: string;
};

export type WeeklyOverviewVotingItem = {
  issueId: string;
  title: string;
  href: string;
  votingClosesAt: string | null;
  daysLeftLabel: string | null;
  votedAtLabel?: string | null;
};

export type WeeklyOverviewHearingItem = {
  hearingId: string;
  title: string;
  href: string;
  fristLabel: string | null;
  deadlineIso: string | null;
};

export type WeeklyOverviewSummaryItem = {
  issueId: string;
  title: string;
  href: string;
  updatedAt: string;
};

export type WeeklyOverviewSporsmalStat = {
  count: number;
  href: string;
  label: string;
};

export type WeeklyOverview = {
  window: WeeklyOverviewWindow;
  votingSoon: WeeklyOverviewVotingItem[];
  votedRecently: WeeklyOverviewVotingItem[];
  openHearings: WeeklyOverviewHearingItem[];
  newSummaries: WeeklyOverviewSummaryItem[];
  skriftligeSporsmal: WeeklyOverviewSporsmalStat;
};

type IssueVotingRow = {
  id: string;
  title: string | null;
  voting_closes_at: string | null;
  ferdigbehandlet: boolean | null;
};

type IssueSaksgangRow = {
  id: string;
  title: string | null;
  detail_json: unknown;
};

function osloDayNumber(date: Date): number {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: KALENDER_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  const [year, month, day] = formatted.split('-').map((part) => Number.parseInt(part, 10));
  return Math.round(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function daysUntilOsloCalendarDeadline(deadline: Date, now: Date): number {
  return osloDayNumber(deadline) - osloDayNumber(now);
}

export function buildWeeklyOverviewWindow(now = new Date()): WeeklyOverviewWindow {
  const pastStart = new Date(now.getTime() - WEEKLY_OVERVIEW_LOOKBACK_MS);
  const futureEnd = new Date(now.getTime() + WEEKLY_OVERVIEW_LOOKAHEAD_MS);
  const pastRangeLabel = `Siste 7 dager (${formatDateNb(pastStart)}–${formatDateNb(now)})`;
  const futureRangeLabel = `Neste 7 dager (${formatDateNb(now)}–${formatDateNb(futureEnd)})`;
  const label = `${pastRangeLabel}. ${futureRangeLabel}.`;
  return { now, pastStart, futureEnd, label, pastRangeLabel, futureRangeLabel };
}

export function isInstantInWeeklyWindow(
  instant: Date,
  window: Pick<WeeklyOverviewWindow, 'pastStart' | 'now'>,
): boolean {
  const t = instant.getTime();
  return t >= window.pastStart.getTime() && t <= window.now.getTime();
}

export function filterHearingsWithInnspillFristWithinDays(
  hearings: StortingetHoring[],
  withinDays: number,
  now = new Date(),
): StortingetHoring[] {
  const filtered = hearings.filter((hearing) => {
    if (!isHoringOpen(hearing, now)) return false;
    const deadline = getHoringInnspillDeadline(hearing);
    if (!deadline) return false;
    const days = daysUntilOsloCalendarDeadline(deadline, now);
    return days >= 0 && days <= withinDays;
  });
  return filtered.sort(compareHoringerByInnspillDeadline);
}

export function filterVotingSoonIssues(
  rows: IssueVotingRow[],
  window: Pick<WeeklyOverviewWindow, 'now' | 'futureEnd'>,
): IssueVotingRow[] {
  const nowMs = window.now.getTime();
  const endMs = window.futureEnd.getTime();
  return rows
    .filter((row) => {
      if (row.ferdigbehandlet === true) return false;
      if (!row.voting_closes_at) return false;
      const closesMs = new Date(row.voting_closes_at).getTime();
      return closesMs >= nowMs && closesMs <= endMs;
    })
    .sort(
      (a, b) =>
        new Date(a.voting_closes_at ?? 0).getTime() - new Date(b.voting_closes_at ?? 0).getTime(),
    );
}

/** Bruker faktisk voteringsdato fra saksgang — ignorerer voting_closes_at=«nå» på ferdigbehandlede saker. */
export function filterRecentlyVotedFromSaksgang(
  rows: IssueSaksgangRow[],
  window: Pick<WeeklyOverviewWindow, 'pastStart' | 'now'>,
): Array<{ id: string; title: string | null; votedAt: Date }> {
  const mapped: Array<{ id: string; title: string | null; votedAt: Date }> = [];
  for (const row of rows) {
    const detail = row.detail_json as StortingetSakDetail | null | undefined;
    const votedAt = getLastPastVoteEventDate(detail, window.now);
    if (!votedAt) continue;
    if (!isInstantInWeeklyWindow(votedAt, window)) continue;
    mapped.push({ id: String(row.id), title: row.title, votedAt });
  }
  return mapped.sort((a, b) => b.votedAt.getTime() - a.votedAt.getTime());
}

export function filterSummariesUpdatedInWindow(
  rows: Array<{ issueId: string; title: string; updatedAt: string }>,
  window: Pick<WeeklyOverviewWindow, 'pastStart' | 'now'>,
): Array<{ issueId: string; title: string; updatedAt: string }> {
  const startMs = window.pastStart.getTime();
  const endMs = window.now.getTime();
  return rows
    .filter((row) => {
      const t = new Date(row.updatedAt).getTime();
      return !Number.isNaN(t) && t >= startMs && t <= endMs;
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function countSkriftligeSporsmalInWindow(
  items: StortingetSporsmal[],
  window: Pick<WeeklyOverviewWindow, 'pastStart' | 'now'>,
): number {
  let count = 0;
  for (const item of items) {
    const sent = parseStortingetDate(item.sendt_dato ? String(item.sendt_dato) : undefined);
    if (!sent) continue;
    if (isInstantInWeeklyWindow(sent, window)) count += 1;
  }
  return count;
}

function mapUpcomingVotingItem(row: IssueVotingRow, now: Date): WeeklyOverviewVotingItem {
  const closesAt = row.voting_closes_at;
  const closesDate = closesAt ? new Date(closesAt) : null;
  const daysLeft =
    closesDate && closesDate.getTime() > now.getTime()
      ? Math.max(1, Math.ceil((closesDate.getTime() - now.getTime()) / 86_400_000))
      : 0;
  return {
    issueId: String(row.id),
    title: row.title?.trim() || `Sak ${row.id}`,
    href: routes.sak(String(row.id)),
    votingClosesAt: closesAt,
    daysLeftLabel: daysLeft > 0 ? formatVotingDaysLeftLabel(daysLeft) : null,
  };
}

function mapVotedItem(row: { id: string; title: string | null; votedAt: Date }): WeeklyOverviewVotingItem {
  return {
    issueId: row.id,
    title: row.title?.trim() || `Sak ${row.id}`,
    href: routes.sak(row.id),
    votingClosesAt: row.votedAt.toISOString(),
    daysLeftLabel: null,
    votedAtLabel: `Votert ${formatDateNb(row.votedAt)}`,
  };
}

function mapHearingItem(hearing: StortingetHoring): WeeklyOverviewHearingItem {
  const deadline = getHoringInnspillDeadline(hearing);
  return {
    hearingId: String(hearing.id),
    title: getHoringTitle(hearing),
    href: routes.horing(String(hearing.id)),
    fristLabel: formatHoringInnspillFristLabel(hearing),
    deadlineIso: deadline?.toISOString() ?? null,
  };
}

async function loadVotingSoonRows(
  window: WeeklyOverviewWindow,
): Promise<{ rows: IssueVotingRow[]; ok: boolean }> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { rows: [], ok: false };
  }

  try {
    const service = getServiceSupabase();
    const nowIso = window.now.toISOString();
    const futureIso = window.futureEnd.toISOString();

    const soonRes = await service
      .from('stortinget_issues')
      .select('id, title, voting_closes_at, ferdigbehandlet')
      .eq('ferdigbehandlet', false)
      .not('voting_closes_at', 'is', null)
      .gte('voting_closes_at', nowIso)
      .lte('voting_closes_at', futureIso)
      .order('voting_closes_at', { ascending: true })
      .limit(WEEKLY_OVERVIEW_LIST_LIMIT);

    if (soonRes.error) {
      console.error('weekly-overview: votering-snart query', soonRes.error);
      return { rows: [], ok: false };
    }

    const soon = filterVotingSoonIssues((soonRes.data ?? []) as IssueVotingRow[], window);
    return { rows: soon, ok: true };
  } catch (error) {
    console.error('weekly-overview: kunne ikke hente votering-snart', error);
    return { rows: [], ok: false };
  }
}

async function loadRecentlyVotedRows(
  window: WeeklyOverviewWindow,
): Promise<{ rows: Array<{ id: string; title: string | null; votedAt: Date }>; ok: boolean }> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { rows: [], ok: false };
  }

  try {
    const service = getServiceSupabase();
    const { data, error } = await service
      .from('stortinget_issues')
      .select('id, title, detail_json')
      .eq('ferdigbehandlet', true)
      .not('detail_json', 'is', null)
      .order('last_updated_at', { ascending: false, nullsFirst: false })
      .limit(120);

    if (error) {
      console.error('weekly-overview: votert query', error);
      return { rows: [], ok: false };
    }

    const rows = filterRecentlyVotedFromSaksgang((data ?? []) as IssueSaksgangRow[], window).slice(
      0,
      WEEKLY_OVERVIEW_LIST_LIMIT,
    );
    return { rows, ok: true };
  } catch (error) {
    console.error('weekly-overview: kunne ikke hente votert', error);
    return { rows: [], ok: false };
  }
}

async function loadSummaryRows(
  window: WeeklyOverviewWindow,
): Promise<{ rows: Array<{ issueId: string; title: string; updatedAt: string }>; ok: boolean }> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { rows: [], ok: false };
  }

  try {
    const service = getServiceSupabase();
    const { data, error } = await service
      .from('issue_ai_summaries')
      .select('stortinget_issue_id, updated_at')
      .gte('updated_at', window.pastStart.toISOString())
      .lte('updated_at', window.now.toISOString())
      .order('updated_at', { ascending: false })
      .limit(WEEKLY_OVERVIEW_LIST_LIMIT * 2);

    if (error) {
      console.error('weekly-overview: sammendrag query', error);
      return { rows: [], ok: false };
    }

    if (!data?.length) {
      return { rows: [], ok: true };
    }

    const issueIds = data.map((row) => String(row.stortinget_issue_id));
    const { data: issues, error: issueError } = await service
      .from('stortinget_issues')
      .select('id, title')
      .in('id', issueIds);

    if (issueError) {
      return { rows: [], ok: false };
    }

    const titleById = new Map(
      (issues ?? []).map((row) => [String(row.id), String(row.title ?? '').trim()]),
    );

    const mapped = data.map((row) => ({
      issueId: String(row.stortinget_issue_id),
      title: titleById.get(String(row.stortinget_issue_id)) || `Sak ${row.stortinget_issue_id}`,
      updatedAt: String(row.updated_at),
    }));

    const rows = filterSummariesUpdatedInWindow(mapped, window).slice(0, WEEKLY_OVERVIEW_LIST_LIMIT);
    return { rows, ok: true };
  } catch (error) {
    console.error('weekly-overview: kunne ikke hente sammendrag', error);
    return { rows: [], ok: false };
  }
}

async function loadSkriftligeSporsmalCount(
  window: WeeklyOverviewWindow,
): Promise<{ count: number; ok: boolean }> {
  try {
    const list = (await getSporsmalListe({
      type: 'skriftligesporsmal',
      nextRevalidateSeconds: 3600,
    })) as StortingetSporsmal[];
    return { count: countSkriftligeSporsmalInWindow(list, window), ok: true };
  } catch (error) {
    console.error('weekly-overview: kunne ikke telle skriftlige spørsmål', error);
    return { count: 0, ok: false };
  }
}

/** Public Stortinget snapshot for /denne-uka and optional weekly digest teaser. */
export function buildEmptyWeeklyOverview(now = new Date()): WeeklyOverview {
  const window = buildWeeklyOverviewWindow(now);
  return {
    window,
    votingSoon: [],
    votedRecently: [],
    openHearings: [],
    newSummaries: [],
    skriftligeSporsmal: {
      count: 0,
      href: routes.sporsmal,
      label: 'Ingen nye skriftlige spørsmål i perioden',
    },
  };
}

export async function buildWeeklyOverview(options?: { now?: Date }): Promise<WeeklyOverview> {
  const now = options?.now ?? new Date();
  const window = buildWeeklyOverviewWindow(now);

  let hearingsOk = false;
  let hearings: StortingetHoring[] = [];
  try {
    hearings = await fetchStortingetHoringer();
    hearingsOk = true;
  } catch (error) {
    console.error('weekly-overview: høringer', error);
  }

  const [votingSoonResult, votedResult, summaryResult, sporsmalResult] = await Promise.all([
    loadVotingSoonRows(window),
    loadRecentlyVotedRows(window),
    loadSummaryRows(window),
    loadSkriftligeSporsmalCount(window),
  ]);

  if (
    !hearingsOk &&
    !votingSoonResult.ok &&
    !votedResult.ok &&
    !summaryResult.ok &&
    !sporsmalResult.ok
  ) {
    throw new Error('weekly-overview: alle datakilder utilgjengelige');
  }

  const openHearings = hearingsOk
    ? filterHearingsWithInnspillFristWithinDays(hearings, WEEKLY_OVERVIEW_HEARING_DEADLINE_DAYS, now)
        .slice(0, WEEKLY_OVERVIEW_LIST_LIMIT)
        .map(mapHearingItem)
    : [];

  const votingSoon = votingSoonResult.rows
    .slice(0, WEEKLY_OVERVIEW_LIST_LIMIT)
    .map((row) => mapUpcomingVotingItem(row, now));

  const votedRecently = votedResult.rows.map(mapVotedItem);

  const newSummaries = summaryResult.rows.map((row) => ({
    issueId: row.issueId,
    title: row.title,
    href: routes.sak(row.issueId),
    updatedAt: row.updatedAt,
  }));

  const sporsmalCount = sporsmalResult.count;
  const sporsmalLabel =
    sporsmalCount === 0
      ? 'Ingen nye skriftlige spørsmål i perioden'
      : sporsmalCount === 1
        ? '1 nytt skriftlig spørsmål'
        : `${sporsmalCount} nye skriftlige spørsmål`;

  return {
    window,
    votingSoon,
    votedRecently,
    openHearings,
    newSummaries,
    skriftligeSporsmal: {
      count: sporsmalCount,
      href: routes.sporsmal,
      label: sporsmalLabel,
    },
  };
}
