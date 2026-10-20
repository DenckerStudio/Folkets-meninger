import { createHmac } from 'node:crypto';
import type { ResearchWebhookBody } from '@/lib/admin/research/types';
import {
  isResearchApiAction,
  researchWebhookPathForAction,
  type ResearchApiAction,
} from '@/lib/admin/research/actions';

export function getResearchWebhookConfig(): {
  baseUrl: string;
  secret: string;
  token: string;
} | null {
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

export async function postResearchWebhook(
  action: ResearchApiAction,
  body: ResearchWebhookBody,
): Promise<{ ok: true } | { ok: false; status: number }> {
  if (!isResearchApiAction(action)) {
    return { ok: false, status: 400 };
  }
  const config = getResearchWebhookConfig();
  if (!config) {
    return { ok: false, status: 503 };
  }

  const rawBody = JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signResearchWebhookPayload(config.secret, timestamp, rawBody);
  const path = researchWebhookPathForAction(action);
  const url = `${config.baseUrl}/${path}`;

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
    });

    if (res.status === 202 || res.ok) {
      return { ok: true };
    }
    return { ok: false, status: res.status };
  } catch {
    return { ok: false, status: 502 };
  }
}
