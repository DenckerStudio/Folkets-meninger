import { postN8nWebhook } from '@/lib/n8n/trigger-webhook';

/** Maks samtidige ai-summary webhook-kall fra fm-web (GP666: én Ollama-jobb om gangen). */
export const AI_SUMMARY_WEBHOOK_MAX_IN_FLIGHT = 1;

const queue: string[] = [];
let inFlight = 0;
let pumpScheduled = false;

export type AiSummaryWebhookDispatchDeps = {
  postWebhook?: typeof postN8nWebhook;
  url?: string;
  webhookToken?: string;
};

function resolveConfig(deps: AiSummaryWebhookDispatchDeps = {}) {
  return {
    postWebhook: deps.postWebhook ?? postN8nWebhook,
    url: deps.url ?? process.env.N8N_AI_SUMMARY_WEBHOOK_URL?.trim(),
    webhookToken: deps.webhookToken ?? process.env.N8N_AI_SUMMARY_WEBHOOK_TOKEN,
  };
}

function schedulePump(deps: AiSummaryWebhookDispatchDeps): void {
  if (pumpScheduled) return;
  pumpScheduled = true;
  queueMicrotask(() => {
    pumpScheduled = false;
    void pumpQueue(deps);
  });
}

async function pumpQueue(deps: AiSummaryWebhookDispatchDeps): Promise<void> {
  const { postWebhook, url, webhookToken } = resolveConfig(deps);
  if (!url) {
    queue.length = 0;
    return;
  }

  while (inFlight < AI_SUMMARY_WEBHOOK_MAX_IN_FLIGHT && queue.length > 0) {
    const issueId = queue.shift();
    if (!issueId) break;

    inFlight += 1;
    void postWebhook(
      url,
      { stortinget_issue_id: issueId },
      'ai-summary',
      undefined,
      undefined,
      webhookToken,
    )
      .catch((err) => {
        console.warn('[ai-summary] webhook dispatch failed:', err);
      })
      .finally(() => {
        inFlight -= 1;
        if (queue.length > 0) {
          schedulePump(deps);
        }
      });
  }
}

/**
 * Kø ai-summary webhook med begrenset parallellitet. Samme issueId kan stå flere ganger i køen
 * (f.eks. etter claim på ulike saker); n8n deduper på sin side.
 */
export function enqueueAiSummaryWebhook(
  stortingetIssueId: string,
  deps: AiSummaryWebhookDispatchDeps = {},
): void {
  const { url } = resolveConfig(deps);
  if (!url) {
    console.warn('[n8n] ai-summary webhook not configured');
    return;
  }

  queue.push(stortingetIssueId);
  schedulePump(deps);
}

/** Test-hjelp: vent til køen er tømt og ingen kall er in flight. */
export async function drainAiSummaryWebhookQueue(
  deps: AiSummaryWebhookDispatchDeps = {},
): Promise<void> {
  const deadline = Date.now() + 15_000;
  while ((queue.length > 0 || inFlight > 0) && Date.now() < deadline) {
    await pumpQueue(deps);
    if (queue.length > 0 || inFlight > 0) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
}

/** Test-hjelp: nullstill kø mellom tester. */
export function resetAiSummaryWebhookQueueForTests(): void {
  queue.length = 0;
  inFlight = 0;
  pumpScheduled = false;
}
