/** App routes — dashboard lives under `/dashboard`. */

export const DASHBOARD_PREFIX = '/dashboard';

export const routes = {
  home: '/',
  dashboard: DASHBOARD_PREFIX,
  utforsk: `${DASHBOARD_PREFIX}/utforsk`,
  minSide: `${DASHBOARD_PREFIX}/min-side`,
  varsler: `${DASHBOARD_PREFIX}/varsler`,
  horinger: `${DASHBOARD_PREFIX}/horinger`,
  politikere: `${DASHBOARD_PREFIX}/politikere`,
  representanter: `${DASHBOARD_PREFIX}/representanter`,
  politikerHub: `${DASHBOARD_PREFIX}/politiker-hub`,
  saksganger: `${DASHBOARD_PREFIX}/saksganger`,
  sporsmal: `${DASHBOARD_PREFIX}/sporsmal`,
  omOss: '/#om-oss',
  innspill: '/innspill',
  login: '/auth/login',
  completeProfile: '/auth/complete-profile',
  politiker: (id: string) => `${DASHBOARD_PREFIX}/politikere/${id}`,
  sporsmalDetail: (id: string) => `${DASHBOARD_PREFIX}/sporsmal/${id}`,
  sak: (id: string) => `${DASHBOARD_PREFIX}/sak/${id}`,
  horing: (id: string) => `${DASHBOARD_PREFIX}/horinger/${id}`,
  profile: (id: string) => `/profil/${id}`,
  adminStats: `${DASHBOARD_PREFIX}/admin/statistikk`,
  innsikt: `${DASHBOARD_PREFIX}/innsikt`,
} as const;

export function isDashboardPath(pathname: string): boolean {
  return pathname === DASHBOARD_PREFIX || pathname.startsWith(`${DASHBOARD_PREFIX}/`);
}

/** Public issue pages linked from the landing page. */
export function isPublicDashboardSakPath(pathname: string): boolean {
  return /^\/dashboard\/sak\/[^/]+$/.test(pathname);
}

/** Public politician explorer and profile pages (Stortinget open data). */
export function isPublicDashboardPolitikerPath(pathname: string): boolean {
  return (
    pathname === routes.politikere ||
    pathname.startsWith(`${routes.politikere}/`)
  );
}

export function isPublicProfilePath(pathname: string): boolean {
  return /^\/profil\/[^/]+$/.test(pathname);
}
