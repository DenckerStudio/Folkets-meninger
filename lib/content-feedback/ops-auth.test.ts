import assert from 'node:assert/strict';
import {
  CONTENT_FEEDBACK_OPS_PATH,
  signContentFeedbackRequest,
  verifyContentFeedbackRequest,
} from '@/lib/content-feedback/ops-hmac';
import {
  contentFeedbackWebhookSecret,
  verifyContentFeedbackWebhook,
} from '@/lib/content-feedback/ops-auth';

const originalSecret = process.env.CMS_CONTENT_FEEDBACK_WEBHOOK_SECRET;
const originalRevalidate = process.env.REVALIDATE_SECRET;

function withSecrets(cmsSecret: string | undefined, fn: () => void) {
  if (cmsSecret === undefined) {
    delete process.env.CMS_CONTENT_FEEDBACK_WEBHOOK_SECRET;
  } else {
    process.env.CMS_CONTENT_FEEDBACK_WEBHOOK_SECRET = cmsSecret;
  }
  delete process.env.REVALIDATE_SECRET;
  try {
    fn();
  } finally {
    if (originalSecret === undefined) {
      delete process.env.CMS_CONTENT_FEEDBACK_WEBHOOK_SECRET;
    } else {
      process.env.CMS_CONTENT_FEEDBACK_WEBHOOK_SECRET = originalSecret;
    }
    if (originalRevalidate !== undefined) {
      process.env.REVALIDATE_SECRET = originalRevalidate;
    }
  }
}

withSecrets('hook-secret', () => {
  assert.equal(contentFeedbackWebhookSecret(), 'hook-secret');
  const body = JSON.stringify({ event: 'published', event_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', post_id: '42' });
  const headers = signContentFeedbackRequest({
    secret: 'hook-secret',
    method: 'POST',
    path: CONTENT_FEEDBACK_OPS_PATH,
    body,
  });
  const request = new Request(`http://localhost${CONTENT_FEEDBACK_OPS_PATH}`, {
    method: 'POST',
    headers,
    body,
  });
  assert.equal(verifyContentFeedbackWebhook(request, body), true);
});

withSecrets('hook-secret', () => {
  const body = JSON.stringify({ event: 'published', event_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', post_id: '42' });
  const headers = signContentFeedbackRequest({
    secret: 'wrong-secret',
    method: 'POST',
    path: CONTENT_FEEDBACK_OPS_PATH,
    body,
  });
  const request = new Request(`http://localhost${CONTENT_FEEDBACK_OPS_PATH}`, {
    method: 'POST',
    headers,
    body,
  });
  assert.equal(verifyContentFeedbackWebhook(request, body), false);
});

withSecrets('hook-secret', () => {
  const body = JSON.stringify({ event: 'published', event_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', post_id: '42' });
  const staleTs = String(Date.now() - 6 * 60 * 1000);
  const headers = signContentFeedbackRequest({
    secret: 'hook-secret',
    method: 'POST',
    path: CONTENT_FEEDBACK_OPS_PATH,
    body,
    timestamp: staleTs,
  });
  const request = new Request(`http://localhost${CONTENT_FEEDBACK_OPS_PATH}`, {
    method: 'POST',
    headers,
    body,
  });
  assert.equal(verifyContentFeedbackWebhook(request, body), false);
});

withSecrets('hook-secret', () => {
  const body = JSON.stringify({ event: 'published', event_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', post_id: '42' });
  const headers = signContentFeedbackRequest({
    secret: 'hook-secret',
    method: 'POST',
    path: CONTENT_FEEDBACK_OPS_PATH,
    body,
  });
  const revalidateBody = JSON.stringify({ slug: 'x' });
  const replayHeaders = {
    ...headers,
    'x-fm-signature': signContentFeedbackRequest({
      secret: 'hook-secret',
      method: 'POST',
      path: '/api/revalidate/blog',
      body: revalidateBody,
    })['x-fm-signature'],
  };
  const request = new Request(`http://localhost${CONTENT_FEEDBACK_OPS_PATH}`, {
    method: 'POST',
    headers: replayHeaders,
    body,
  });
  assert.equal(verifyContentFeedbackWebhook(request, body), false);
});

withSecrets(undefined, () => {
  assert.equal(contentFeedbackWebhookSecret(), null);
  process.env.REVALIDATE_SECRET = 'revalidate-only';
  assert.equal(contentFeedbackWebhookSecret(), null);
});

{
  const ts = String(Date.now());
  const signed = signContentFeedbackRequest({
    secret: 's',
    method: 'POST',
    path: CONTENT_FEEDBACK_OPS_PATH,
    body: '{}',
    timestamp: ts,
  });
  assert.equal(
    verifyContentFeedbackRequest({
      secret: 's',
      method: 'POST',
      path: CONTENT_FEEDBACK_OPS_PATH,
      body: '{}',
      timestampHeader: ts,
      signatureHeader: signed['x-fm-signature'],
    }),
    true,
  );
}

console.log('content-feedback/ops-auth.test.ts: ok');
