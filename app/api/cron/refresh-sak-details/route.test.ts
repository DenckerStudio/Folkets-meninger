import assert from 'node:assert/strict';
import { GET, POST } from './route';

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
  await withSecret('test-secret', async () => {
    const noAuth = await GET(new Request('http://localhost/api/cron/refresh-sak-details?ids=200506'));
    assert.equal(noAuth.status, 401);

    const badIds = await GET(
      new Request('http://localhost/api/cron/refresh-sak-details?ids=abc', {
        headers: { 'x-cron-secret': 'test-secret' },
      }),
    );
    assert.equal(badIds.status, 400);
    const badBody = await badIds.json();
    assert.equal(badBody.ok, false);
    assert.deepEqual(badBody.invalid, ['abc']);

    const postNoAuth = await POST(new Request('http://localhost/api/cron/refresh-sak-details?ids=1'));
    assert.equal(postNoAuth.status, 401);
  });

  console.log('app/api/cron/refresh-sak-details/route.test.ts: ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});