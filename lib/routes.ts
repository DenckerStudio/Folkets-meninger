/** App routes — dashboard lives under `/dashboard`. */

export const DASHBOARD_PREFIX = '/dashboard';

export const routes = {
  home: '/',
  dashboard: DASHBOARD_PREFIX,
  utforsk: `${DASHBOARD_PREFIX}/utforsk`,
  minSide: `${DASHBOARD_PREFIX}/min-side`,
  varsler: `${DASHBOARD_PREFIX}/varsler`,
  horinger: `${DASHBOARD_PREFIX}/horinger`,
  forum: `${DASHBOARD_PREFIX}/forum`,
  forumNew: (sakId?: string) =>
    sakId ? `${DASHBOARD_PREFIX}/forum/ny?sak=${sakId}` : `${DASHBOARD_PREFIX}/forum/ny`,
  forumSpesielleSaker: `${DASHBOARD_PREFIX}/forum/spesielle-saker`,
  forumForeslaReel: `${DASHBOARD_PREFIX}/forum/foresla-reel`,
  politikere: `${DASHBOARD_PREFIX}/politikere`,
  representanter: `${DASHBOARD_PREFIX}/representanter`,
  politikerHub: `${DASHBOARD_PREFIX}/politiker-hub`,
  saksganger: `${DASHBOARD_PREFIX}/saksganger`,
  sporsmal: `${DASHBOARD_PREFIX}/sporsmal`,
  omOss: '/om-oss',
  login: '/auth/login',
  completeProfile: '/auth/complete-profile',
  politiker: (id: string) => `${DASHBOARD_PREFIX}/politikere/${id}`,
  sporsmalDetail: (id: string) => `${DASHBOARD_PREFIX}/sporsmal/${id}`,
  sak: (id: string) => `${DASHBOARD_PREFIX}/sak/${id}`,
  horing: (id: string) => `${DASHBOARD_PREFIX}/horinger/${id}`,
  forumTopic: (id: string) => `${DASHBOARD_PREFIX}/forum/${id}`,
  profile: (id: string) => `/profil/${id}`,
  adminForumPrompts: `${DASHBOARD_PREFIX}/admin/forum-prompts`,
  adminForumClusters: `${DASHBOARD_PREFIX}/admin/forum-clusters`,
  adminForumReports: `${DASHBOARD_PREFIX}/admin/forum-reports`,
  adminStats: `${DASHBOARD_PREFIX}/admin/statistikk`,
  innsikt: `${DASHBOARD_PREFIX}/innsikt`,
  forumMineInnlegg: `${DASHBOARD_PREFIX}/forum/mine-innlegg`,
  /** @deprecated Use forumMineInnlegg */
  minSideForumPosts: `${DASHBOARD_PREFIX}/forum/mine-innlegg`,
} as const;

export function isDashboardPath(pathname: string): boolean {
  return pathname === DASHBOARD_PREFIX || pathname.startsWith(`${DASHBOARD_PREFIX}/`);
}

/** Public issue pages linked from the landing page. */
export function isPublicDashboardSakPath(pathname: string): boolean {
  return /^\/dashboard\/sak\/[^/]+$/.test(pathname);
}

export function isForumRelatedPath(pathname: string): boolean {
  return pathname.startsWith(`${DASHBOARD_PREFIX}/forum`) || pathname.includes('/forum');
}

export function isPublicProfilePath(pathname: string): boolean {
  return /^\/profil\/[^/]+$/.test(pathname);
}
