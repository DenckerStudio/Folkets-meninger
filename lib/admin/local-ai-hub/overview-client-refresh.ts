export const LOCAL_AI_OVERVIEW_API_PATH = '/api/admin/local-ai-hub/overview';

export const LOCAL_AI_OVERVIEW_REFRESH_HEADER = 'X-Local-Ai-Hub-Refresh';

/** Klient-«Oppdater»: tvinger server å hoppe over minne-cache, men ett kall. */
export function buildOverviewRefreshRequestInit(): RequestInit {
  return {
    cache: 'no-store',
    headers: {
      [LOCAL_AI_OVERVIEW_REFRESH_HEADER]: '1',
    },
  };
}
