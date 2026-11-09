import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const clientPaths = [
  'components/research-topics/landing-research-topics-lazy.tsx',
  'components/research-topics/landing-research-topics.tsx',
  'components/research-topics/public-research-topic-card.tsx',
];

for (const relative of clientPaths) {
  const src = readFileSync(join(process.cwd(), relative), 'utf8');
  assert.doesNotMatch(src, /@\/lib\/admin\/research\/topic-service/);
  assert.doesNotMatch(src, /@\/lib\/admin\/research\/topic-sak-poll/);
  assert.doesNotMatch(src, /@\/lib\/research-topics\/public-service/);
  assert.doesNotMatch(src, /hmac/);
  assert.doesNotMatch(src, /node:crypto/);
  assert.doesNotMatch(src, /topic\.title/);
  assert.doesNotMatch(src, /rawTitle/);
  assert.match(src, /public-map/);
}

const lazySrc = readFileSync(
  join(process.cwd(), 'components/research-topics/landing-research-topics-lazy.tsx'),
  'utf8',
);
assert.match(lazySrc, /\/api\/public\/research-topics/);

console.log('lib/research-topics/public-client-boundary.test.ts: ok');
