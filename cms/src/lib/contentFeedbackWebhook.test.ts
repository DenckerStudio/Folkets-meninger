import assert from 'node:assert/strict';
import {
  ContentFeedbackWebhookError,
  sendContentFeedbackWebhook,
} from './contentFeedbackWebhook';

const originalFetch = globalThis.fetch;
const originalSecret = process.env.CMS_CONTENT_FEEDBACK_WEBHOOK_SECRET;
const originalRevalidate = process.env.REVALIDATE_SECRET;
const originalWebUrl = process.env.FM_WEB_URL;

async function run() {
  process.env.CMS_CONTENT_FEEDBACK_WEBHOOK_SECRET = 'test-secret';
  process.env.FM_WEB_URL = 'https://www.example.test';

  globalThis.fetch = (async () =>
    new Response('ok', { status: 200 })) as typeof fetch;
  await sendContentFeedbackWebhook(sampleBody(), { error: () => undefined });

  globalThis.fetch = (async () =>
    new Response('fail', { status: 503 })) as typeof fetch;
  await assert.rejects(
    () => sendContentFeedbackWebhook(sampleBody(), { error: () => undefined }),
    (error: unknown) =>
      error instanceof ContentFeedbackWebhookError && error.kind === 'retryable',
  );

  const clientErrors: Record<string, unknown>[] = [];
  globalThis.fetch = (async () =>
    new Response('nope', { status: 403 })) as typeof fetch;
  await assert.rejects(
    () => sendContentFeedbackWebhook(sampleBody(), { error: (o) => clientErrors.push(o) }),
    (error: unknown) =>
      error instanceof ContentFeedbackWebhookError && error.kind === 'client',
  );
  assert.equal(clientErrors[0]?.status, 403);

  globalThis.fetch = (async () => {
    throw new Error('network down');
  }) as typeof fetch;
  await assert.rejects(
    () => sendContentFeedbackWebhook(sampleBody(), { error: () => undefined }),
    (error: unknown) =>
      error instanceof ContentFeedbackWebhookError && error.kind === 'retryable',
  );

  delete process.env.CMS_CONTENT_FEEDBACK_WEBHOOK_SECRET;
  await assert.rejects(
    () => sendContentFeedbackWebhook(sampleBody(), { error: () => undefined }),
    (error: unknown) =>
      error instanceof ContentFeedbackWebhookError && error.kind === 'config',
  );

  process.env.REVALIDATE_SECRET = 'revalidate-fallback';
  delete process.env.FM_WEB_URL;
  await assert.rejects(
    () => sendContentFeedbackWebhook(sampleBody(), { error: () => undefined }),
    (error: unknown) =>
      error instanceof ContentFeedbackWebhookError && error.kind === 'config',
  );

  process.env.FM_WEB_URL = 'https://www.example.test';
  globalThis.fetch = (async () =>
    new Response('ok', { status: 200 })) as typeof fetch;
  await sendContentFeedbackWebhook(sampleBody(), { error: () => undefined });

  globalThis.fetch = originalFetch;
  if (originalSecret === undefined) {
    delete process.env.CMS_CONTENT_FEEDBACK_WEBHOOK_SECRET;
  } else {
    process.env.CMS_CONTENT_FEEDBACK_WEBHOOK_SECRET = originalSecret;
  }
  if (originalRevalidate === undefined) {
    delete process.env.REVALIDATE_SECRET;
  } else {
    process.env.REVALIDATE_SECRET = originalRevalidate;
  }
  if (originalWebUrl === undefined) {
    delete process.env.FM_WEB_URL;
  } else {
    process.env.FM_WEB_URL = originalWebUrl;
  }

  console.log('cms/src/lib/contentFeedbackWebhook.test.ts ok');
}

function sampleBody() {
  return {
    event: 'published' as const,
    event_id: 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee',
    post_id: '1',
    slug: 's',
    title: 't',
    excerpt: 'e',
    categories: [] as string[],
    origin: 'n8n',
    occurred_at: new Date().toISOString(),
  };
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
