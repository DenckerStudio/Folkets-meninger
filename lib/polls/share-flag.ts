/**
 * Global launch flag for the public `/del` + `/embed` widget routes.
 * Off in prod by default (those URLs 404). In-app «Del» always shares the
 * canonical poll page (`/dashboard/avstemninger/...`) regardless of this flag.
 */
export function isSharePollsEnabled(): boolean {
  const raw = process.env.SHARE_POLLS_ENABLED?.trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}
