import { createHash } from 'node:crypto';
import { classifyReferrer, type ReferrerBucket } from '@/lib/analytics/referrer';

const ALLOWED_EVENT_NAMES = new Set([
  'page_view',
  'share_link_click',
  'poll_share_landing',
] as const);

export type AnalyticsEventName =
  | 'page_view'
  | 'share_link_click'
  | 'poll_share_landing';

export type ParsedCollectPayload = {
  eventName: AnalyticsEventName;
  path: string;
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  refCode: string | null;
  shareCode: string | null;
  metadata: { bucket: ReferrerBucket };
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
  if (typeof eventName !== 'string' || !ALLOWED_EVENT_NAMES.has(eventName as AnalyticsEventName)) {
    return { ok: false };
  }

  const path = requiredTrimmedString(record.path, MAX_PATH_LEN);
  if (!path || !path.startsWith('/')) {
    return { ok: false };
  }

  const referrerRaw = optionalTrimmedString(record.referrer, 2048);
  const utmSource = optionalTrimmedString(record.utmSource, MAX_FIELD_LEN);
  const utmMedium = optionalTrimmedString(record.utmMedium, MAX_FIELD_LEN);
  const utmCampaign = optionalTrimmedString(record.utmCampaign, MAX_FIELD_LEN);
  const refCode = optionalTrimmedString(record.ref, MAX_FIELD_LEN);
  const shareCode = optionalTrimmedString(record.shareCode, MAX_FIELD_LEN);

  const { bucket } = classifyReferrer({
    referrerUrl: referrerRaw ?? undefined,
    utmSource: utmSource ?? undefined,
  });

  return {
    ok: true,
    value: {
      eventName: eventName as AnalyticsEventName,
      path,
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
  metadata: { bucket: ReferrerBucket };
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
