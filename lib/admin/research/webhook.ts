import { createHmac } from 'node:crypto';
import type { ResearchWebhookBody } from '@/lib/admin/research/types';
import {
  isResearchApiAction,
  researchWebhookPathForAction,
  type ResearchApiAction,
} from '@/lib/admin/research/actions';

export type ResearchWebhookConfig = {
  baseUrl: string;
  secret: string;
  token: string;
};

/** Krever base, HMAC-secret og egen Header Auth-token (aldri logg token). */
export function getResearchWebhookConfig(): ResearchWebhookConfig | null {
  const baseUrl = process.env.N8N_RESEARCH_WEBHOOK_BASE?.replace(/\/+$/, '');
  const secret = process.env.N8N_RESEARCH_WEBHOOK_SECRET?.trim();
  const token = process.env.N8N_RESEARCH_WEBHOOK_TOKEN?.trim();
  if (!baseUrl || !secret || !token) return null;
  return { baseUrl, secret, token };
}

export function signResearchWebhookPayload(
  secret: string,
  timestamp: string,
  rawBody: string,
): string {
  const digest = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
  return `sha256=${digest}`;
}

export type ResearchWebhookPostResult =
  | { ok: true }
  | { ok: false; reason: 'not_configured' }
  | { ok: false; reason: 'timeout' }
  | { ok: false; reason: 'http'; status?: number };

const RESEARCH_WEBHOOK_TIMEOUT_MS = 60_000;

export async function postResearchWebhook(
  action: ResearchApiAction,
  body: ResearchWebhookBody,
): Promise<ResearchWebhookPostResult> {
  if (!isResearchApiAction(action)) {
    return { ok: false, reason: 'http', status: 400 };
  }
  const config = getResearchWebhookConfig();
  if (!config) {
    return { ok: false, reason: 'not_configured' };
  }

  const rawBody = JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signResearchWebhookPayload(config.secret, timestamp, rawBody);
  const path = researchWebhookPathForAction(action);
  const url = `${config.baseUrl}/${path}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RESEARCH_WEBHOOK_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-FM-Timestamp': timestamp,
        'X-FM-Signature': signature,
        'X-FM-Webhook-Token': config.token,
      },
      body: rawBody,
      signal: controller.signal,
    });

    if (res.status === 202 || res.ok) {
      return { ok: true };
    }
    return { ok: false, reason: 'http', status: res.status };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { ok: false, reason: 'timeout' };
    }
    return { ok: false, reason: 'http', status: 502 };
  } finally {
    clearTimeout(timeoutId);
  }
}
