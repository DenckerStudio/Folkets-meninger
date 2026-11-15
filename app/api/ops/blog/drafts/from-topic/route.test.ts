import assert from 'node:assert/strict';
import { POST } from './route';

const originalSecret = process.env.CRON_SECRET;

function withSecret(secret: string | undefined, fn: () => Promise<void>) {
  if (secret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = secret;
  }
  return fn().finally(() => {
    if (originalSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalSecret;
    }
  });
}

async function run() {
  await withSecret('test-cron-secret', async () => {
    const noAuth = await POST(
      new Request('http://localhost/api/ops/blog/drafts/from-topic', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic_id: '11111111-1111-4111-8111-111111111111' }),
      }),
    );
    assert.equal(noAuth.status, 401);

    const badSecret = await POST(
      new Request('http://localhost/api/ops/blog/drafts/from-topic', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-cron-secret': 'wrong',
        },
        body: JSON.stringify({ topic_id: '11111111-1111-4111-8111-111111111111' }),
      }),
    );
    assert.equal(badSecret.status, 401);

    const invalidBody = await POST(
      new Request('http://localhost/api/ops/blog/drafts/from-topic', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-cron-secret': 'test-cron-secret',
        },
        body: JSON.stringify({ topic_id: 'not-uuid' }),
      }),
    );
    assert.equal(invalidBody.status, 400);
    const invalidJson = await invalidBody.json();
    assert.equal(invalidJson.ok, false);
    assert.equal(invalidJson.error_code, 'invalid_input');
    assert.equal(invalidJson.retryable, false);
  });

  console.log('app/api/ops/blog/drafts/from-topic/route.test.ts ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});