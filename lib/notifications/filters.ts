import type { NotificationFrequency } from '@/lib/notifications/channels';

/** User-facing notification categories (Stemme+ can toggle these). */
export const NOTIFICATION_PREFERENCE_TYPES = [
  'new_case',
  'reply_to_opinion',
  'vote_open_close',
  'hearing_deadline',
] as const;

export type NotificationPreferenceType = (typeof NOTIFICATION_PREFERENCE_TYPES)[number];

/** Global rule for free users and fallback when columns are missing. */
export const DEFAULT_MAX_CASE_AGE_DAYS = 30;
export const MIN_MAX_CASE_AGE_DAYS = 7;
export const MAX_MAX_CASE_AGE_DAYS = 365;

export const NOTIFICATION_PREFERENCE_COLUMNS =
  'skip_finished,max_case_age_days,enabled_types,only_followed,channel_in_app,channel_push,channel_email,frequency';

export type NotificationPreferencesV2 = {
  skip_finished: boolean;
  max_case_age_days: number;
  enabled_types: NotificationPreferenceType[];
  only_followed: boolean;
  channel_in_app: boolean;
  channel_push: boolean;
  channel_email: boolean;
  frequency: NotificationFrequency;
};

export const FREE_NOTIFICATION_PREFERENCES: NotificationPreferencesV2 = {
  skip_finished: true,
  max_case_age_days: DEFAULT_MAX_CASE_AGE_DAYS,
  enabled_types: [...NOTIFICATION_PREFERENCE_TYPES],
  only_followed: false,
  channel_in_app: true,
  channel_push: true,
  channel_email: false,
  frequency: 'weekly',
};

export const PLUS_DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferencesV2 = {
  ...FREE_NOTIFICATION_PREFERENCES,
  channel_email: true,
};

function isPreferenceType(value: unknown): value is NotificationPreferenceType {
  return (
    typeof value === 'string' &&
    (NOTIFICATION_PREFERENCE_TYPES as readonly string[]).includes(value)
  );
}

export function clampMaxCaseAgeDays(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_MAX_CASE_AGE_DAYS;
  return Math.min(MAX_MAX_CASE_AGE_DAYS, Math.max(MIN_MAX_CASE_AGE_DAYS, Math.round(n)));
}

/**
 * Tier-aware normalization. Free users always get FREE_NOTIFICATION_PREFERENCES
 * except the in-app and push toggles, which are open to everyone.
 */
export function normalizeNotificationPreferences(
  raw: Record<string, unknown> | null | undefined,
  isPlus: boolean,
): NotificationPreferencesV2 {
  const r = raw ?? {};
  const channel_in_app =
    typeof r.channel_in_app === 'boolean' ? r.channel_in_app : FREE_NOTIFICATION_PREFERENCES.channel_in_app;
  const channel_push =
    typeof r.channel_push === 'boolean' ? r.channel_push : FREE_NOTIFICATION_PREFERENCES.channel_push;

  if (!isPlus) {
    return { ...FREE_NOTIFICATION_PREFERENCES, channel_in_app, channel_push };
  }

  const d = PLUS_DEFAULT_NOTIFICATION_PREFERENCES;
  const frequency =
    r.frequency === 'realtime' || r.frequency === 'daily' || r.frequency === 'weekly'
      ? r.frequency
      : d.frequency;
  return {
    skip_finished: typeof r.skip_finished === 'boolean' ? r.skip_finished : d.skip_finished,
    max_case_age_days:
      r.max_case_age_days === undefined || r.max_case_age_days === null
        ? d.max_case_age_days
        : clampMaxCaseAgeDays(r.max_case_age_days),
    enabled_types: Array.isArray(r.enabled_types)
      ? [...new Set(r.enabled_types.filter(isPreferenceType))]
      : [...d.enabled_types],
    only_followed: typeof r.only_followed === 'boolean' ? r.only_followed : d.only_followed,
    channel_in_app,
    channel_push,
    channel_email: typeof r.channel_email === 'boolean' ? r.channel_email : d.channel_email,
    frequency,
  };
}

/** Maps internal notification `type` strings to a user-facing preference type. */
export function preferenceTypeForNotification(type: string): NotificationPreferenceType | null {
  if (type.startsWith('new_case')) return 'new_case';
  if (type.startsWith('opinion_') || type.startsWith('reply')) return 'reply_to_opinion';
  if (type.startsWith('poll_') || type.startsWith('vote_')) return 'vote_open_close';
  if (type.startsWith('hearing') || type.startsWith('horing')) return 'hearing_deadline';
  return null;
}

/** Types generated from the user's own subscriptions or own content. */
export function isFollowedNotificationType(type: string): boolean {
  return (
    type === 'new_case_in_category' ||
    type === 'new_case_for_label' ||
    type.startsWith('opinion_')
  );
}

export type CaseInfo = {
  date?: string | null;
  status?: string | null;
  ferdigbehandlet?: boolean | null;
};

export function readCaseInfo(data: Record<string, unknown> | null | undefined): CaseInfo {
  const d = data ?? {};
  return {
    date: typeof d.date === 'string' ? d.date : null,
    status: typeof d.status === 'string' ? d.status : null,
    ferdigbehandlet: typeof d.ferdigbehandlet === 'boolean' ? d.ferdigbehandlet : null,
  };
}

export function isCaseFinished(info: CaseInfo): boolean {
  return info.ferdigbehandlet === true || info.status === 'closed';
}

export function isCaseOlderThan(info: CaseInfo, maxAgeDays: number, now = Date.now()): boolean {
  if (!info.date) return false;
  const t = new Date(info.date).getTime();
  if (Number.isNaN(t)) return false;
  return now - t > maxAgeDays * 24 * 60 * 60 * 1000;
}

/**
 * Global old-case rule, applied before user preferences:
 * never notify about ferdigbehandlet cases or cases older than 30 days.
 * Stemme+ may only tighten it (shorter age), or turn off skip_finished / raise the age limit.
 */
export function shouldSendNotification(
  prefs: NotificationPreferencesV2,
  isPlus: boolean,
  type: string,
  info: CaseInfo,
  now = Date.now(),
): boolean {
  const skipFinished = isPlus ? prefs.skip_finished : true;
  const maxAge = isPlus ? prefs.max_case_age_days : DEFAULT_MAX_CASE_AGE_DAYS;

  if (skipFinished && isCaseFinished(info)) return false;
  if (isCaseOlderThan(info, maxAge, now)) return false;

  if (isPlus) {
    const prefType = preferenceTypeForNotification(type);
    if (prefType && !prefs.enabled_types.includes(prefType)) return false;
    if (prefs.only_followed && !isFollowedNotificationType(type)) return false;
  }

  return true;
}

/** Cap a cron cursor so a missing/ancient last-seen value never replays history. */
export function capLastSeenMs(lastSeenMs: number | null | undefined, now = Date.now()): number {
  const floor = now - DEFAULT_MAX_CASE_AGE_DAYS * 24 * 60 * 60 * 1000;
  if (!lastSeenMs || !Number.isFinite(lastSeenMs)) return floor;
  return Math.max(lastSeenMs, floor);
}

/** True when a Supabase/PostgREST error means the v2 columns are not migrated yet. */
export function isMissingColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === '42703' || error.code === 'PGRST204' || /column .* does not exist/i.test(error.message ?? '');
}
