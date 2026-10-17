import { DASHBOARD_PREFIX, routes } from '@/lib/routes';

const EXACT_LABELS: Record<string, string> = {
  [routes.dashboard]: 'dashboardet',
  [routes.utforsk]: 'Utforsk',
  [routes.folketsMeninger]: 'Folkets meninger',
  [routes.avstemninger]: 'Avstemninger',
  [routes.horinger]: 'Høringer',
  [routes.politikere]: 'Politikere',
  [routes.kalender]: 'Kalender',
  [routes.innsikt]: 'Innsikt',
  [routes.forslag]: 'Appens fremtid',
  [routes.minSide]: 'Min side',
  [routes.admin]: 'Admin',
  [routes.completeProfile]: 'profiloppsettet',
  [routes.onboarding]: 'oppstarten',
};

/** Short label for login `?next=` hint — path only, no open redirect. */
export function labelForLoginNext(path: string): string {
  const pathname = path.split('?')[0]?.split('#')[0] ?? path;
  const exact = EXACT_LABELS[pathname];
  if (exact) return exact;

  if (pathname.startsWith(`${routes.avstemninger}/`)) return 'avstemningen';
  if (pathname.startsWith(`${routes.horinger}/`)) return 'høringen';
  if (pathname.startsWith(`${DASHBOARD_PREFIX}/sak/`)) return 'saken';
  if (pathname.startsWith(`${routes.folketsMeninger}/`)) return 'meningen';
  if (pathname.startsWith(`${routes.politikere}/`)) return 'politikeren';
  if (pathname.startsWith(`${routes.admin}/`)) return 'admin';

  return pathname;
}
