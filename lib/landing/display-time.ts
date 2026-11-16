/** Offentlige tidsstempler på forsiden — alltid norsk lokal tid (Coolify kjører UTC). */
export const LANDING_DISPLAY_TIMEZONE = 'Europe/Oslo';

const LANDING_DATETIME_OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: LANDING_DISPLAY_TIMEZONE,
};

export function formatLandingPollDeadline(closesAt: string, now = Date.now()): string | null {
  const date = new Date(closesAt);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getTime() <= now) return null;
  return date.toLocaleString('nb-NO', LANDING_DATETIME_OPTIONS);
}