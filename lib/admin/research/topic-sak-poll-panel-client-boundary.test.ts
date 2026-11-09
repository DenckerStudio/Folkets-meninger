import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const panelSrc = readFileSync(
  join(process.cwd(), 'components/admin/research-topic-sak-poll-panel.tsx'),
  'utf8',
);

assert.doesNotMatch(panelSrc, /@\/lib\/admin\/research\/topic-sak-poll['"]/);
assert.doesNotMatch(panelSrc, /blog-ops-client/);
assert.doesNotMatch(panelSrc, /@\/lib\/cms\//);
assert.doesNotMatch(panelSrc, /hmac/);
assert.doesNotMatch(panelSrc, /node:crypto/);
assert.match(panelSrc, /topic-sak-poll-client/);

const clientHelperSrc = readFileSync(
  join(process.cwd(), 'lib/admin/research/topic-sak-poll-client.ts'),
  'utf8',
);
assert.doesNotMatch(clientHelperSrc, /topic-sak-poll\.ts/);
assert.doesNotMatch(clientHelperSrc, /blog-ops-client/);
assert.doesNotMatch(clientHelperSrc, /node:crypto/);

console.log('lib/admin/research/topic-sak-poll-panel-client-boundary.test.ts: ok');
