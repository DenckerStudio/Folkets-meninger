import { createNotification } from '@/lib/notifications';
import { getServiceSupabase } from '@/lib/supabase';
import {
  fetchStortingetHoringer,
  getDaysUntilHoringDeadline,
  getHoringInnspillDeadline,
  getHoringTitle,
  isHoringOpen,
  type StortingetHoring,
} from '@/lib/stortinget-horinger';
import { isHearingDeadlineAlertsEnabled } from '@/lib/hearing-deadline-alerts-flag';
import { routes } from '@/lib/routes';

export const HEARING_DEADLINE_ALERT_DAYS_BEFORE = 3;
export const HEARING_DEADLINE_ALERT_TYPE = 'hearing_deadline_soon';

export type HearingDeadlineAlertRunResult = {
  enabled: boolean;
  hearingsChecked: number;
  candidates: number;
  sent: number;
  skipped: number;
  failed: number;
};

type InterestRow = {
  user_id: string;
  stortinget_hearing_id: string;
};

function hearingsWithDeadlineInDays(hearings: StortingetHoring[], daysBefore: number): StortingetHoring[] {
  return hearings.filter((hearing) => {
    if (!isHoringOpen(hearing) || !getHoringInnspillDeadline(hearing)) return false;
    return getDaysUntilHoringDeadline(hearing) === daysBefore;
  });
}

async function loadInterestedUsers(hearingIds: string[]): Promise<InterestRow[]> {
  if (hearingIds.length === 0) return [];
  const service = getServiceSupabase();
  const { data, error } = await service
    .from('hearing_user_interest')
    .select('user_id,stortinget_hearing_id')
    .in('stortinget_hearing_id', hearingIds)
    .or('followed_at.not.is.null,draft_opened_at.not.is.null');
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as InterestRow[];
}

async function alreadyNotified(userId: string, hearingId: string, daysBefore: number): Promise<boolean> {
  const service = getServiceSupabase();
  const { count, error } = await service
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', HEARING_DEADLINE_ALERT_TYPE)
    .filter('data->>hearingId', 'eq', hearingId)
    .filter('data->>daysBefore', 'eq', String(daysBefore));
  if (error) return false;
  return (count ?? 0) > 0;
}

export async function runHearingDeadlineAlerts(args?: {
  hearings?: StortingetHoring[];
  origin?: string;
  now?: Date;
}): Promise<HearingDeadlineAlertRunResult> {
  const empty: HearingDeadlineAlertRunResult = {
    enabled: false,
    hearingsChecked: 0,
    candidates: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  if (!isHearingDeadlineAlertsEnabled()) {
    return empty;
  }

  const hearings = args?.hearings ?? (await fetchStortingetHoringer());
  const matching = hearingsWithDeadlineInDays(hearings, HEARING_DEADLINE_ALERT_DAYS_BEFORE);
  const hearingIds = matching.map((h) => String(h.id));
  const interests = await loadInterestedUsers(hearingIds);

  const hearingById = new Map(matching.map((h) => [String(h.id), h]));
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of interests) {
    const hearing = hearingById.get(row.stortinget_hearing_id);
    if (!hearing) continue;

    if (await alreadyNotified(row.user_id, row.stortinget_hearing_id, HEARING_DEADLINE_ALERT_DAYS_BEFORE)) {
      skipped += 1;
      continue;
    }

    const title = getHoringTitle(hearing);
    const deadline = getHoringInnspillDeadline(hearing);
    const body = deadline
      ? `Innspillsfristen for «${title}» er om ${HEARING_DEADLINE_ALERT_DAYS_BEFORE} dager (${deadline.toLocaleDateString('nb-NO', { timeZone: 'Europe/Oslo' })}).`
      : `Innspillsfristen for «${title}» nærmer seg.`;

    const result = await createNotification({
      userId: row.user_id,
      type: HEARING_DEADLINE_ALERT_TYPE,
      channel: 'categories',
      title: 'Høringsfrist om 3 dager',
      body,
      url: routes.horing(row.stortinget_hearing_id),
      data: {
        hearingId: row.stortinget_hearing_id,
        daysBefore: HEARING_DEADLINE_ALERT_DAYS_BEFORE,
        date: deadline?.toISOString() ?? null,
      },
      origin: args?.origin,
    });

    if (!result.ok) {
      failed += 1;
    } else if (result.emailSkippedReason === 'filtered') {
      skipped += 1;
    } else {
      sent += 1;
    }
  }

  return {
    enabled: true,
    hearingsChecked: matching.length,
    candidates: interests.length,
    sent,
    skipped,
    failed,
  };
}