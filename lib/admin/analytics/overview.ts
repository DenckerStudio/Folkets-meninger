import { getServiceSupabase } from '@/lib/supabase';
import { postgrestErrorCode } from '@/lib/admin/postgrest-error';

export type AdminAnalyticsOverview = {
  ready: boolean;
  user: {
    totalRegistered: number;
    newLast7Days: number;
    signedInLast30Days: number;
    inactiveApprox: number;
    inactiveDaysThreshold: number;
    stemmePlus: number;
  } | null;
  links: Array<{
    id: string;
    code: string;
    targetKind: string;
    targetId: string;
    label: string | null;
    createdAt: string;
    creatorEmail: string;
    clicks: number;
  }>;
  traffic: {
    pageViews: number;
    uniqueVisitors: number;
    pollLandings: number;
    shareClicks: number;
    topPaths: Array<{ path: string; views: number }>;
    channels: Array<{ bucket: string; views: number }>;
    blogPaths: Array<{ path: string; views: number }>;
  } | null;
};

type PostgrestLikeError = {
  code?: string;
  message?: string;
};

const missingRpcFunctionMessage = /function .* does not exist/i;

export function isMissingAnalyticsRpc(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const row = error as PostgrestLikeError;
  if (row.code === 'PGRST202' || row.code === '42883') return true;
  const message = typeof row.message === 'string' ? row.message : '';
  return missingRpcFunctionMessage.test(message);
}

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '');
}

function mapPathViews(rows: unknown): Array<{ path: string; views: number }> {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    return { path: asString(r.path), views: asNumber(r.views) };
  });
}

function mapChannelViews(rows: unknown): Array<{ bucket: string; views: number }> {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    return { bucket: asString(r.bucket), views: asNumber(r.views) };
  });
}

function mapShareLinks(rows: unknown): AdminAnalyticsOverview['links'] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    const label = r.label;
    return {
      id: asString(r.id),
      code: asString(r.code),
      targetKind: asString(r.target_kind ?? r.targetKind),
      targetId: asString(r.target_id ?? r.targetId),
      label: label === null || label === undefined ? null : asString(label),
      createdAt: asString(r.created_at ?? r.createdAt),
      creatorEmail: asString(r.creator_email ?? r.creatorEmail),
      clicks: asNumber(r.clicks),
    };
  });
}

export function mapAdminAnalyticsOverview(raw: {
  userMetrics: Record<string, unknown> | null;
  shareLinks: Record<string, unknown> | null;
  trafficOverview: Record<string, unknown> | null;
}): AdminAnalyticsOverview {
  const userRaw = raw.userMetrics;
  const user =
    userRaw && typeof userRaw === 'object'
      ? {
          totalRegistered: asNumber(userRaw.totalRegistered),
          newLast7Days: asNumber(userRaw.newLast7Days),
          signedInLast30Days: asNumber(userRaw.signedInLast30Days),
          inactiveApprox: asNumber(userRaw.inactiveApprox),
          inactiveDaysThreshold: asNumber(userRaw.inactiveDaysThreshold),
          stemmePlus: asNumber(userRaw.stemmePlus),
        }
      : null;

  const linksPayload = raw.shareLinks;
  const links = mapShareLinks(linksPayload?.links);

  const trafficRaw = raw.trafficOverview;
  const traffic =
    trafficRaw && typeof trafficRaw === 'object'
      ? {
          pageViews: asNumber(trafficRaw.pageViews),
          uniqueVisitors: asNumber(trafficRaw.uniqueVisitors),
          pollLandings: asNumber(trafficRaw.pollLandings),
          shareClicks: asNumber(trafficRaw.shareClicks),
          topPaths: mapPathViews(trafficRaw.topPaths),
          channels: mapChannelViews(trafficRaw.channels),
          blogPaths: mapPathViews(trafficRaw.blogPaths),
        }
      : null;

  return { ready: true, user, links, traffic };
}

export const analyticsOverviewNotReady: AdminAnalyticsOverview = {
  ready: false,
  user: null,
  links: [],
  traffic: null,
};

export async function loadAdminAnalyticsOverview(
  adminUserId: string,
): Promise<AdminAnalyticsOverview> {
  const service = getServiceSupabase();

  const [userRes, linksRes, trafficRes] = await Promise.all([
    service.rpc('admin_get_user_metrics', { p_admin_user_id: adminUserId }),
    service.rpc('admin_get_share_link_stats', { p_admin_user_id: adminUserId }),
    service.rpc('admin_get_analytics_overview', { p_admin_user_id: adminUserId }),
  ]);

  for (const res of [userRes, linksRes, trafficRes]) {
    if (res.error && isMissingAnalyticsRpc(res.error)) {
      return analyticsOverviewNotReady;
    }
  }

  if (userRes.error || linksRes.error || trafficRes.error) {
    const err = userRes.error ?? linksRes.error ?? trafficRes.error;
    const code = postgrestErrorCode(err);
    throw new Error(
      code
        ? `Kunne ikke laste admin-statistikk (kode ${code})`
        : 'Kunne ikke laste admin-statistikk',
    );
  }

  return mapAdminAnalyticsOverview({
    userMetrics: userRes.data as Record<string, unknown>,
    shareLinks: linksRes.data as Record<string, unknown>,
    trafficOverview: trafficRes.data as Record<string, unknown>,
  });
}
