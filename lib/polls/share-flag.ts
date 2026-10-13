/**
 * Global launch flag for the shareable poll widget (`/del`, `/embed` and the
 * "Del" entry points). Off by default so the feature can ship dark and be
 * switched on per environment. Admins can still open the routes for preview
 * while the flag is off.
 */
export function isSharePollsEnabled(): boolean {
  const raw = process.env.SHARE_POLLS_ENABLED?.trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}
