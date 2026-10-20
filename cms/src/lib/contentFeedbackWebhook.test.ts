import assert from 'node:assert/strict';
import { sendContentFeedbackWebhook } from './contentFeedbackWebhook';

const originalFetch = globalThis.fetch;
const originalSecret = process.env.CMS_CONTENT_FEEDBACK_WEBHOOK_SECRET;
const originalWebUrl = process.env.FM_WEB_URL;

process.env.CMS_CONTENT_FEEDBACK_WEBHOOK_SECRET = 'test-secret';
process.env.FM_WEB_URL = 'https://www.example.test';

let fetchCalls = 0;
globalThis.fetch = (async () => {
  fetchCalls += 1;
  throw new Error('network down');
}) as typeof fetch;

const warnings: Record<string, unknown>[] = [];
const errors: Record<string, unknown>[] = [];
sendContentFeedbackWebhook(
  {
    event: 'published',
    event_id: 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee',
    post_id: '1',
    slug: 's',
    title: 't',
    excerpt: 'e',
    categories: [],
    origin: 'n8n',
    occurred_at: new Date().toISOString(),
  },
  {
    error: (obj) => {
      errors.push(obj);
    },
    warn: (obj) => {
      warnings.push(obj);
    },
  },
);

async function run() {
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(fetchCalls, 1);
  assert.equal(errors.length, 1);
  assert.equal(errors[0]?.msg, 'content-feedback webhook failed');

  delete process.env.CMS_CONTENT_FEEDBACK_WEBHOOK_SECRET;
  sendContentFeedbackWebhook(
    {
      event: 'published',
      event_id: 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee',
      post_id: '2',
      slug: 's',
      title: 't',
      excerpt: 'e',
      categories: [],
      origin: 'n8n',
      occurred_at: new Date().toISOString(),
    },
    {
      error: (obj) => errors.push(obj),
      warn: (obj) => warnings.push(obj),
    },
  );
  assert.equal(warnings.some((w) => w.msg?.toString().includes('signing secret')), true);

  globalThis.fetch = originalFetch;
  if (originalSecret === undefined) {
    delete process.env.CMS_CONTENT_FEEDBACK_WEBHOOK_SECRET;
  } else {
    process.env.CMS_CONTENT_FEEDBACK_WEBHOOK_SECRET = originalSecret;
  }
  if (originalWebUrl === undefined) {
    delete process.env.FM_WEB_URL;
  } else {
    process.env.FM_WEB_URL = originalWebUrl;
  }

  console.log('cms/src/lib/contentFeedbackWebhook.test.ts ok');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
