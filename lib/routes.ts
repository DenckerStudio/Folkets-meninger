/** App routes — dashboard lives under `/dashboard`. */

export const DASHBOARD_PREFIX = '/dashboard';

export const routes = {
  home: '/',
  dashboard: DASHBOARD_PREFIX,
  folketsMeninger: `${DASHBOARD_PREFIX}/folkets-meninger`,
  folketsMeningerForSak: (id: string, opts?: { compose?: boolean }) =>
    `${DASHBOARD_PREFIX}/folkets-meninger?sak=${encodeURIComponent(id)}${opts?.compose ? '&compose=1' : ''}`,
  utforsk: `${DASHBOARD_PREFIX}/utforsk`,
  utforskReels: (pollId?: string) =>
    pollId
      ? `${DASHBOARD_PREFIX}/utforsk/reels?poll=${encodeURIComponent(pollId)}`
      : `${DASHBOARD_PREFIX}/utforsk/reels`,
  avstemninger: `${DASHBOARD_PREFIX}/avstemninger`,
  minSide: `${DASHBOARD_PREFIX}/min-side`,
  horinger: `${DASHBOARD_PREFIX}/horinger`,
  kalender: `${DASHBOARD_PREFIX}/kalender`,
  horingerIcs: '/api/kalender/horinger.ics',
  politikere: `${DASHBOARD_PREFIX}/politikere`,
  representanter: `${DASHBOARD_PREFIX}/representanter`,
  politikerHub: `${DASHBOARD_PREFIX}/politiker-hub`,
  saksganger: `${DASHBOARD_PREFIX}/saksganger`,
  sporsmal: `${DASHBOARD_PREFIX}/sporsmal`,
  omOss: '/#om-oss',
  personvern: '/personvern',
  vilkar: '/vilkar',
  omAi: '/om/ai',
  hvaErAnnerledes: '/#hva-er-annerledes',
  innspill: '/innspill',
  blogg: '/blogg',
  bloggPost: (slug: string) => `/blogg/${encodeURIComponent(slug)}`,
  login: '/auth/login',
  glemtPassord: '/auth/glemt-passord',
  tilbakestillPassord: '/auth/tilbakestill-passord',
  completeProfile: '/auth/complete-profile',
  onboarding: '/auth/onboarding',
  politiker: (id: string) => `${DASHBOARD_PREFIX}/politikere/${id}`,
  parti: (name: string) =>
    `${DASHBOARD_PREFIX}/politikere?parti=${encodeURIComponent(name)}`,
  sporsmalDetail: (id: string) => `${DASHBOARD_PREFIX}/sporsmal/${id}`,
  sak: (id: string) => `${DASHBOARD_PREFIX}/sak/${id}`,
  opinion: (id: string) => `${DASHBOARD_PREFIX}/folkets-meninger/${id}`,
  sakEmbed: (id: string) => `/embed/sak/${id}`,
  poll: (id: string) => `${DASHBOARD_PREFIX}/avstemninger/${id}`,
  sharePoll: (id: string) => `/del/${encodeURIComponent(id)}`,
  pollEmbed: (id: string) => `/embed/${encodeURIComponent(id)}`,
  horing: (id: string) => `${DASHBOARD_PREFIX}/horinger/${id}`,
  profile: (id: string) => `/profil/${id}`,
  admin: `${DASHBOARD_PREFIX}/admin`,
  adminStats: `${DASHBOARD_PREFIX}/admin/statistikk`,
  adminReels: `${DASHBOARD_PREFIX}/admin/reels`,
  adminForslag: `${DASHBOARD_PREFIX}/admin/forslag`,
  adminBrukere: `${DASHBOARD_PREFIX}/admin/brukere`,
  adminStemmePlus: `${DASHBOARD_PREFIX}/admin/stemme-plus`,
  adminResearch: `${DASHBOARD_PREFIX}/admin/research`,
  adminResearchCluster: (id: string) =>
    `${DASHBOARD_PREFIX}/admin/research/${encodeURIComponent(id)}`,
  adminVurder: `${DASHBOARD_PREFIX}/admin/vurder`,
  innsikt: `${DASHBOARD_PREFIX}/innsikt`,
  forslag: `${DASHBOARD_PREFIX}/appens-fremtid`,
  chat: `${DASHBOARD_PREFIX}/chat`,
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

/** Public Ja/Nei/Blank ballots — guests can read; voting requires login. */
export function isPublicDashboardAvstemningPath(pathname: string): boolean {
  return pathname === routes.avstemninger || /^\/dashboard\/avstemninger\/[^/]+$/.test(pathname);
}

/** Public Utforsk (saker + system Reels) — guests can read; voting requires login. */
export function isPublicDashboardUtforskPath(pathname: string): boolean {
  return pathname === routes.utforsk || pathname.startsWith(`${routes.utforsk}/`);
}

/** Legacy chat URL — redirects to Utforsk and opens the overlay. */
export function isPublicDashboardChatPath(pathname: string): boolean {
  return pathname === routes.chat;
}

/** Public Folkets meninger list and detail — posting requires login. */
export function isPublicDashboardFolketsMeningerPath(pathname: string): boolean {
  return (
    pathname === routes.folketsMeninger ||
    /^\/dashboard\/folkets-meninger\/[^/]+$/.test(pathname)
  );
}

/** Stortinget hearings — guests can read; innspill/comments require login. */
export function isPublicDashboardHoringerPath(pathname: string): boolean {
  return pathname === routes.horinger || pathname.startsWith(`${routes.horinger}/`);
}

/** Parliamentary calendar — read-only for guests. */
export function isPublicDashboardKalenderPath(pathname: string): boolean {
  return pathname === routes.kalender;
}

export function isPublicProfilePath(pathname: string): boolean {
  return /^\/profil\/[^/]+$/.test(pathname);
}

/** Marketing routes (landing + innspill): marketing header/footer, full-width layout. */
export function isMarketingPath(pathname: string): boolean {
  return (
    pathname === routes.home ||
    pathname === routes.innspill ||
    pathname === routes.personvern ||
    pathname === routes.vilkar ||
    pathname === routes.omAi ||
    pathname === routes.blogg ||
    pathname.startsWith(`${routes.blogg}/`)
  );
}

export function isEmbedPath(pathname: string): boolean {
  return pathname.startsWith('/embed/');
}

/** Public shareable poll widget page (Ja / Vet ikke / Nei). */
export function isSharePollPath(pathname: string): boolean {
  return /^\/del\/[^/]+$/.test(pathname);
}
