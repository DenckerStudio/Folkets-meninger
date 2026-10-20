import assert from 'node:assert/strict';
import { buildSignedHeaders } from '@/lib/cms/hmac';
import {
  contentFeedbackWebhookSecret,
  verifyContentFeedbackWebhook,
} from '@/lib/content-feedback/ops-auth';

const originalSecret = process.env.CMS_CONTENT_FEEDBACK_WEBHOOK_SECRET;
const originalRevalidate = process.env.REVALIDATE_SECRET;

function withSecrets(
  cmsSecret: string | undefined,
  revalidate: string | undefined,
  fn: () => void,
) {
  if (cmsSecret === undefined) {
    delete process.env.CMS_CONTENT_FEEDBACK_WEBHOOK_SECRET;
  } else {
    process.env.CMS_CONTENT_FEEDBACK_WEBHOOK_SECRET = cmsSecret;
  }
  if (revalidate === undefined) {
    delete process.env.REVALIDATE_SECRET;
  } else {
    process.env.REVALIDATE_SECRET = revalidate;
  }
  try {
    fn();
  } finally {
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
  }
}

withSecrets('hook-secret', undefined, () => {
  assert.equal(contentFeedbackWebhookSecret(), 'hook-secret');
  const body = JSON.stringify({ event: 'published', post_id: '42' });
  const headers = buildSignedHeaders(body, 'hook-secret');
  const request = new Request('http://localhost/api/ops/content-feedback', {
    method: 'POST',
    headers,
    body,
  });
  assert.equal(verifyContentFeedbackWebhook(request, body), true);
});

withSecrets('hook-secret', undefined, () => {
  const body = JSON.stringify({ event: 'published', post_id: '42' });
  const headers = buildSignedHeaders(body, 'wrong-secret');
  const request = new Request('http://localhost/api/ops/content-feedback', {
    method: 'POST',
    headers,
    body,
  });
  assert.equal(verifyContentFeedbackWebhook(request, body), false);
});

withSecrets('hook-secret', undefined, () => {
  const body = JSON.stringify({ event: 'published', post_id: '42' });
  const staleTs = String(Date.now() - 6 * 60 * 1000);
  const headers = {
    'Content-Type': 'application/json',
    'x-fm-timestamp': staleTs,
    'x-fm-signature': buildSignedHeaders(body, 'hook-secret')['x-fm-signature'],
  };
  const request = new Request('http://localhost/api/ops/content-feedback', {
    method: 'POST',
    headers,
    body,
  });
  assert.equal(verifyContentFeedbackWebhook(request, body), false);
});

console.log('content-feedback/ops-auth.test.ts: ok');
