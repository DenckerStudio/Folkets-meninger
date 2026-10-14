import { routes } from '@/lib/routes';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert';

const nextConfigPath = join(process.cwd(), 'next.config.ts');
const nextConfigContent = readFileSync(nextConfigPath, 'utf-8');

function testUtforskReelsRoute() {
  // Test routes.utforskReels() without pollId
  const baseUrl = routes.utforskReels();
  assert.strictEqual(baseUrl, '/dashboard/utforsk/reels', 'utforskReels() should return /dashboard/utforsk/reels');

  // Test routes.utforskReels('a b') with pollId containing space
  const withPollId = routes.utforskReels('a b');
  assert.strictEqual(
    withPollId,
    '/dashboard/utforsk/reels?poll=a%20b',
    'utforskReels("a b") should return URL-encoded poll parameter'
  );

  console.log('✓ routes.utforskReels() tests passed');
}

function testNextConfigRedirects() {
  // Check that all 4 redirects to /dashboard/utforsk/reels exist in next.config.ts
  const redirects = [
    { source: '/avstemninger/reels', destination: '/dashboard/utforsk/reels' },
    { source: '/dashboard/avstemninger/reels', destination: '/dashboard/utforsk/reels' },
    { source: '/reels', destination: '/dashboard/utforsk/reels' },
    { source: '/dashboard/reels', destination: '/dashboard/utforsk/reels' },
  ];

  for (const redirect of redirects) {
    const pattern = new RegExp(
      `source:\\s*['"]${redirect.source.replace('/', '\\/')}['"]\\s*,\\s*destination:\\s*['"]${redirect.destination.replace('/', '\\/')}['"]`
    );
    assert.ok(
      pattern.test(nextConfigContent),
      `next.config.ts should contain redirect from ${redirect.source} to ${redirect.destination}`
    );
  }

  console.log('✓ next.config.ts redirect tests passed');
}

testUtforskReelsRoute();
testNextConfigRedirects();

console.log('All reels-route tests passed!');