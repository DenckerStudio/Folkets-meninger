import { createHash } from 'node:crypto';
import { classifyReferrer, type ReferrerBucket } from '@/lib/analytics/referrer';
import { normalizeAnalyticsPathTemplate } from '@/lib/analytics/path-template';

const ALLOWED_EVENT_NAMES = new Set([
  'page_view',
  'share_link_click',
  'poll_share_landing',
  'http_error',
]);

export type AnalyticsEventName =
  | 'page_view'
  | 'share_link_click'
  | 'poll_share_landing'
  | 'http_error';

export type AnalyticsEventMetadata = {
  bucket?: ReferrerBucket;
  status?: number;
  method?: string;
  source?: 'app' | 'client';
};

export type ParsedCollectPayload = {
  eventName: AnalyticsEventName;
  path: string;
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  refCode: string | null;
  shareCode: string | null;
  metadata: AnalyticsEventMetadata;
};

export type ParseCollectResult =
  | { ok: true; value: ParsedCollectPayload }
  | { ok: false };

const MAX_PATH_LEN = 500;
const MAX_FIELD_LEN = 64;

function optionalTrimmedString(value: unknown, maxLen: number): string | null {
  if (value == null || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLen) {
    return null;
  }
  return trimmed;
}

function requiredTrimmedString(value: unknown, maxLen: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLen) {
    return null;
  }
  return trimmed;
}

function firstTrimmedField(
  record: Record<string, unknown>,
  keys: string[],
  maxLen: number,
): string | null {
  for (const key of keys) {
    const value = optionalTrimmedString(record[key], maxLen);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

function parseHttpStatus(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value >= 400 && value <= 599 ? value : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isInteger(n) && n >= 400 && n <= 599) {
      return n;
    }
  }
  return null;
}

function parseHttpMethod(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const method = value.trim().toUpperCase();
  if (!method || method.length > 16) {
    return null;
  }
  if (!/^[A-Z]+$/.test(method)) {
    return null;
  }
  return method;
}

export function extractReferrerHost(referrerUrl: string | null | undefined): string | null {
  const raw = referrerUrl?.trim();
  if (!raw) {
    return null;
  }
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    return host || null;
  } catch {
    return null;
  }
}

export function parseCollectPayload(body: unknown): ParseCollectResult {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false };
  }

  const record = body as Record<string, unknown>;
  const eventName = record.eventName;
  if (typeof eventName !== 'string' || !ALLOWED_EVENT_NAMES.has(eventName)) {
    return { ok: false };
  }

  const pathRaw = requiredTrimmedString(record.path, MAX_PATH_LEN);
  if (!pathRaw || !pathRaw.startsWith('/')) {
    return { ok: false };
  }

  if (eventName === 'http_error') {
    const status = parseHttpStatus(record.status ?? record.httpStatus);
    if (status === null) {
      return { ok: false };
    }
    const method = parseHttpMethod(record.method) ?? 'GET';
    const path = normalizeAnalyticsPathTemplate(pathRaw);
    return {
      ok: true,
      value: {
        eventName: 'http_error',
        path,
        referrerHost: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        refCode: null,
        shareCode: null,
        metadata: {
          status,
          method,
          source: 'client',
        },
      },
    };
  }

  const referrerRaw = optionalTrimmedString(record.referrer, 2048);
  const utmSource = firstTrimmedField(record, ['utmSource', 'utm_source'], MAX_FIELD_LEN);
  const utmMedium = firstTrimmedField(record, ['utmMedium', 'utm_medium'], MAX_FIELD_LEN);
  const utmCampaign = firstTrimmedField(
    record,
    ['utmCampaign', 'utm_campaign'],
    MAX_FIELD_LEN,
  );
  const refCode = firstTrimmedField(record, ['ref', 'ref_code'], MAX_FIELD_LEN);
  const shareCode = optionalTrimmedString(record.shareCode, MAX_FIELD_LEN);

  const { bucket } = classifyReferrer({
    referrerUrl: referrerRaw ?? undefined,
    utmSource: utmSource ?? undefined,
  });

  return {
    ok: true,
    value: {
      eventName: eventName as Exclude<AnalyticsEventName, 'http_error'>,
      path: pathRaw,
      referrerHost: extractReferrerHost(referrerRaw),
      utmSource,
      utmMedium,
      utmCampaign,
      refCode,
      shareCode,
      metadata: { bucket },
    },
  };
}

export function computeSessionHash(params: {
  secret: string | undefined;
  ip: string;
  userAgent: string;
  utcDate: string;
}): string | null {
  const secret = params.secret?.trim();
  if (!secret) {
    return null;
  }
  return createHash('sha256')
    .update(`${secret}|${params.ip}|${params.userAgent}|${params.utcDate}`)
    .digest('hex');
}

export function utcDateString(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export type AnalyticsInsertRow = {
  event_name: string;
  path: string;
  referrer_host: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  ref_code: string | null;
  share_link_id: string | null;
  session_hash: string | null;
  metadata: AnalyticsEventMetadata;
};

export function buildAnalyticsInsertRow(params: {
  payload: ParsedCollectPayload;
  shareLinkId: string | null;
  sessionHash: string | null;
}): AnalyticsInsertRow {
  const { payload, shareLinkId, sessionHash } = params;
  return {
    event_name: payload.eventName,
    path: payload.path,
    referrer_host: payload.referrerHost,
    utm_source: payload.utmSource,
    utm_medium: payload.utmMedium,
    utm_campaign: payload.utmCampaign,
    ref_code: payload.refCode,
    share_link_id: shareLinkId,
    session_hash: sessionHash,
    metadata: payload.metadata,
  };
}
