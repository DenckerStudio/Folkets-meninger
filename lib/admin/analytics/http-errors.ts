import { getServiceSupabase } from '@/lib/supabase';
import { isMissingAnalyticsRpc } from '@/lib/admin/analytics/overview';
import { postgrestErrorCode } from '@/lib/admin/postgrest-error';

export type AdminHttpErrorsOverview = {
  ready: boolean;
  days: number;
  source: string;
  errorRowCountHuman: number;
  errorRowCountBot: number;
  top404: Array<{ pathTemplate: string; host: string; requestCount: number }>;
  statusClasses: Array<{ statusClass: string; requestCount: number }>;
  fiveXxByDay: Array<{ bucketDate: string; requestCount: number }>;
};

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

export const httpErrorsNotReady: AdminHttpErrorsOverview = {
  ready: false,
  days: 30,
  source: 'traefik',
  errorRowCountHuman: 0,
  errorRowCountBot: 0,
  top404: [],
  statusClasses: [],
  fiveXxByDay: [],
};

export function mapAdminHttpErrors(raw: Record<string, unknown> | null): AdminHttpErrorsOverview {
  if (!raw || typeof raw !== 'object') {
    return httpErrorsNotReady;
  }

  const top404Raw = Array.isArray(raw.top404) ? raw.top404 : [];
  const statusClassesRaw = Array.isArray(raw.statusClasses) ? raw.statusClasses : [];
  const fiveXxRaw = Array.isArray(raw.fiveXxByDay) ? raw.fiveXxByDay : [];

  return {
    ready: raw.ready !== false,
    days: asNumber(raw.days) || 30,
    source: asString(raw.source) || 'traefik',
    errorRowCountHuman: asNumber(raw.errorRowCountHuman),
    errorRowCountBot: asNumber(raw.errorRowCountBot),
    top404: top404Raw.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        pathTemplate: asString(r.path_template ?? r.pathTemplate),
        host: asString(r.host),
        requestCount: asNumber(r.request_count ?? r.requestCount),
      };
    }),
    statusClasses: statusClassesRaw.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        statusClass: asString(r.status_class ?? r.statusClass),
        requestCount: asNumber(r.request_count ?? r.requestCount),
      };
    }),
    fiveXxByDay: fiveXxRaw.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        bucketDate: asString(r.bucket_date ?? r.bucketDate),
        requestCount: asNumber(r.request_count ?? r.requestCount),
      };
    }),
  };
}

export async function loadAdminHttpErrors(
  adminUserId: string,
  days = 30,
): Promise<AdminHttpErrorsOverview> {
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('admin_get_http_errors', {
    p_admin_user_id: adminUserId,
    p_days: days,
  });

  if (error && isMissingAnalyticsRpc(error)) {
    return httpErrorsNotReady;
  }

  if (error) {
    const code = postgrestErrorCode(error);
    throw new Error(
      code
        ? `Kunne ikke laste HTTP-feilstatistikk (kode ${code})`
        : 'Kunne ikke laste HTTP-feilstatistikk',
    );
  }

  return mapAdminHttpErrors(data as Record<string, unknown>);
}
