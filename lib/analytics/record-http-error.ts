import 'server-only';

import { isLikelyBot } from '@/lib/analytics/bot';
import {
  buildAnalyticsInsertRow,
  type ParsedCollectPayload,
} from '@/lib/analytics/collect-server';
import { isAnalyticsEnabled } from '@/lib/analytics/flags';
import { normalizeAnalyticsPathTemplate } from '@/lib/analytics/path-template';
import { checkRateLimit } from '@/lib/rate-limit';
import { getServiceSupabase } from '@/lib/supabase';

export type RecordAppHttpErrorInput = {
  path: string;
  status: number;
  method?: string;
  userAgent?: string | null;
  ip?: string | null;
};

/**
 * Server-side anonymous http_error event (no raw IP stored).
 * Fire-and-forget from selected public API routes / helpers.
 */
export async function recordAppHttpError(input: RecordAppHttpErrorInput): Promise<void> {
  if (!isAnalyticsEnabled()) {
    return;
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return;
  }
  if (!Number.isInteger(input.status) || input.status < 400 || input.status > 599) {
    return;
  }
  if (input.path.startsWith('/api/admin') || input.path.startsWith('/dashboard/admin')) {
    return;
  }
  if (isLikelyBot(input.userAgent)) {
    return;
  }

  const ipKey = input.ip?.trim() || 'unknown';
  const rate = await checkRateLimit(`analytics-app-http-error:${ipKey}`, 30, 60_000);
  if (!rate.ok) {
    return;
  }

  const method = (input.method ?? 'GET').trim().toUpperCase() || 'GET';
  const payload: ParsedCollectPayload = {
    eventName: 'http_error',
    path: normalizeAnalyticsPathTemplate(input.path),
    referrerHost: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    refCode: null,
    shareCode: null,
    metadata: {
      status: input.status,
      method,
      source: 'app',
    },
  };

  const row = buildAnalyticsInsertRow({
    payload,
    shareLinkId: null,
    sessionHash: null,
  });

  try {
    const service = getServiceSupabase();
    const { error } = await service.rpc('insert_analytics_event', { p_row: row });
    if (error) {
      console.error(`analytics http_error insert failed: ${error.code ?? error.message}`);
    }
  } catch (err) {
    console.error('analytics http_error insert threw', err);
  }
}
