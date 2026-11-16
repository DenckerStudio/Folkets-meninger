import assert from 'node:assert/strict';
import { POST } from './route';

async function run() {
  const crossSiteRes = await POST(
    new Request('http://localhost/api/user/delete-account', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'sec-fetch-site': 'cross-site',
        origin: 'https://evil.example',
      },
      body: JSON.stringify({ confirmation: 'SLETT' }),
    }),
  );
  assert.equal(crossSiteRes.status, 403);

  console.log('app/api/user/delete-account/route.test.ts: ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});