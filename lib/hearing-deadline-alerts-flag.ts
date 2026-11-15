/** Off in prod by default; cron must not send until HEARING_DEADLINE_ALERTS_ENABLED is set. */
export function isHearingDeadlineAlertsEnabled(): boolean {
  const raw = process.env.HEARING_DEADLINE_ALERTS_ENABLED?.trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}