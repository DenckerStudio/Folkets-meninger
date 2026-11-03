import { buildTopicBriefWebhookPayloadForDocs } from '@/lib/admin/research/topic-webhook-body';
import { getResearchWebhookConfig, signResearchWebhookPayload } from '@/lib/admin/research/webhook';
import type { ResearchTopicWebhookBody } from '@/lib/admin/research/topic-types';
import { researchTopicWebhookPath } from '@/lib/admin/research/topic-types';

export type ResearchTopicWebhookPostResult =
  | { ok: true }
  | { ok: false; reason: 'not_configured' }
  | { ok: false; reason: 'timeout' }
  | { ok: false; reason: 'http'; status?: number };

const RESEARCH_TOPIC_WEBHOOK_TIMEOUT_MS = 60_000;

export async function postResearchTopicWebhook(
  body: ResearchTopicWebhookBody,
): Promise<ResearchTopicWebhookPostResult> {
  const config = getResearchWebhookConfig();
  if (!config) {
    return { ok: false, reason: 'not_configured' };
  }

  const rawBody = JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signResearchWebhookPayload(config.secret, timestamp, rawBody);
  const url = `${config.baseUrl}/${researchTopicWebhookPath()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RESEARCH_TOPIC_WEBHOOK_TIMEOUT_MS);

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

export { buildTopicBriefWebhookPayloadForDocs, signResearchWebhookPayload, researchTopicWebhookPath };
