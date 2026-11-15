import { KALENDER_TIMEZONE } from '@/lib/kalender-events';
import { getServiceSupabase } from '@/lib/supabase';
import { formatVotingDaysLeftLabel } from '@/lib/sak-voting-window';
import { routes } from '@/lib/routes';
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

export const WEEKLY_OVERVIEW_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
export const WEEKLY_OVERVIEW_LOOKAHEAD_MS = 7 * 24 * 60 * 60 * 1000;
export const WEEKLY_OVERVIEW_HEARING_DEADLINE_DAYS = 7;
export const WEEKLY_OVERVIEW_LIST_LIMIT = 12;

export type WeeklyOverviewWindow = {
  now: Date;
  pastStart: Date;
  futureEnd: Date;
  label: string;
};

export type WeeklyOverviewVotingItem = {
  issueId: string;
  title: string;
  href: string;
  votingClosesAt: string | null;
  daysLeftLabel: string | null;
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
  const label = `${formatDateNb(pastStart)} – ${formatDateNb(futureEnd)}`;
  return { now, pastStart, futureEnd, label };
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
    if (!isHoringOpen(hearing)) return false;
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

export function filterRecentlyVotedIssues(
  rows: IssueVotingRow[],
  window: Pick<WeeklyOverviewWindow, 'pastStart' | 'now'>,
): IssueVotingRow[] {
  const startMs = window.pastStart.getTime();
  const nowMs = window.now.getTime();
  return rows
    .filter((row) => {
      if (row.ferdigbehandlet !== true) return false;
      if (!row.voting_closes_at) return false;
      const closesMs = new Date(row.voting_closes_at).getTime();
      return closesMs >= startMs && closesMs <= nowMs;
    })
    .sort(
      (a, b) =>
        new Date(b.voting_closes_at ?? 0).getTime() - new Date(a.voting_closes_at ?? 0).getTime(),
    );
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

function mapVotingItem(row: IssueVotingRow, now: Date): WeeklyOverviewVotingItem {
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
    daysLeftLabel:
      daysLeft > 0
        ? formatVotingDaysLeftLabel(daysLeft)
        : closesDate
          ? 'Votert i perioden'
          : null,
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

async function loadVotingIssueRows(
  window: WeeklyOverviewWindow,
): Promise<{ soon: IssueVotingRow[]; recent: IssueVotingRow[] }> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { soon: [], recent: [] };
  }

  try {
    const service = getServiceSupabase();
    const nowIso = window.now.toISOString();
    const pastIso = window.pastStart.toISOString();
    const futureIso = window.futureEnd.toISOString();

    const [soonRes, recentRes] = await Promise.all([
      service
        .from('stortinget_issues')
        .select('id, title, voting_closes_at, ferdigbehandlet')
        .eq('ferdigbehandlet', false)
        .not('voting_closes_at', 'is', null)
        .gte('voting_closes_at', nowIso)
        .lte('voting_closes_at', futureIso)
        .order('voting_closes_at', { ascending: true })
        .limit(WEEKLY_OVERVIEW_LIST_LIMIT),
      service
        .from('stortinget_issues')
        .select('id, title, voting_closes_at, ferdigbehandlet')
        .eq('ferdigbehandlet', true)
        .not('voting_closes_at', 'is', null)
        .gte('voting_closes_at', pastIso)
        .lte('voting_closes_at', nowIso)
        .order('voting_closes_at', { ascending: false })
        .limit(WEEKLY_OVERVIEW_LIST_LIMIT),
    ]);

    const soon = filterVotingSoonIssues((soonRes.data ?? []) as IssueVotingRow[], window);
    const recent = filterRecentlyVotedIssues((recentRes.data ?? []) as IssueVotingRow[], window);
    return { soon, recent };
  } catch (error) {
    console.error('weekly-overview: kunne ikke hente voteringssaker', error);
    return { soon: [], recent: [] };
  }
}

async function loadSummaryRows(
  window: WeeklyOverviewWindow,
): Promise<Array<{ issueId: string; title: string; updatedAt: string }>> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return [];
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

    if (error || !data?.length) return [];

    const issueIds = data.map((row) => String(row.stortinget_issue_id));
    const { data: issues, error: issueError } = await service
      .from('stortinget_issues')
      .select('id, title')
      .in('id', issueIds);

    if (issueError) return [];

    const titleById = new Map(
      (issues ?? []).map((row) => [String(row.id), String(row.title ?? '').trim()]),
    );

    const mapped = data.map((row) => ({
      issueId: String(row.stortinget_issue_id),
      title: titleById.get(String(row.stortinget_issue_id)) || `Sak ${row.stortinget_issue_id}`,
      updatedAt: String(row.updated_at),
    }));

    return filterSummariesUpdatedInWindow(mapped, window).slice(0, WEEKLY_OVERVIEW_LIST_LIMIT);
  } catch (error) {
    console.error('weekly-overview: kunne ikke hente sammendrag', error);
    return [];
  }
}

async function loadSkriftligeSporsmalCount(window: WeeklyOverviewWindow): Promise<number> {
  try {
    const list = (await getSporsmalListe({
      type: 'skriftligesporsmal',
      nextRevalidateSeconds: 3600,
    })) as StortingetSporsmal[];
    return countSkriftligeSporsmalInWindow(list, window);
  } catch (error) {
    console.error('weekly-overview: kunne ikke telle skriftlige spørsmål', error);
    return 0;
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

  const [hearings, votingRows, summaryRows, sporsmalCount] = await Promise.all([
    fetchStortingetHoringer().catch(() => [] as StortingetHoring[]),
    loadVotingIssueRows(window),
    loadSummaryRows(window),
    loadSkriftligeSporsmalCount(window),
  ]);

  const openHearings = filterHearingsWithInnspillFristWithinDays(
    hearings,
    WEEKLY_OVERVIEW_HEARING_DEADLINE_DAYS,
    now,
  )
    .slice(0, WEEKLY_OVERVIEW_LIST_LIMIT)
    .map(mapHearingItem);

  const votingSoon = votingRows.soon
    .slice(0, WEEKLY_OVERVIEW_LIST_LIMIT)
    .map((row) => mapVotingItem(row, now));

  const votedRecently = votingRows.recent
    .slice(0, WEEKLY_OVERVIEW_LIST_LIMIT)
    .map((row) => mapVotingItem(row, now));

  const newSummaries = summaryRows.map((row) => ({
    issueId: row.issueId,
    title: row.title,
    href: routes.sak(row.issueId),
    updatedAt: row.updatedAt,
  }));

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