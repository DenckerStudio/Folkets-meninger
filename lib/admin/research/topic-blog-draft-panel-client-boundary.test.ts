import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const panelSrc = readFileSync(
  join(process.cwd(), 'components/admin/research-topic-blog-draft-panel.tsx'),
  'utf8',
);

assert.doesNotMatch(panelSrc, /@\/lib\/admin\/research\/topic-blog-draft['"]/);
assert.doesNotMatch(panelSrc, /blog-ops-client/);
assert.doesNotMatch(panelSrc, /@\/lib\/cms\//);
assert.doesNotMatch(panelSrc, /hmac/);
assert.doesNotMatch(panelSrc, /node:crypto/);
assert.match(panelSrc, /topic-blog-draft-client/);

const clientHelperSrc = readFileSync(
  join(process.cwd(), 'lib/admin/research/topic-blog-draft-client.ts'),
  'utf8',
);
assert.doesNotMatch(clientHelperSrc, /blog-ops-client/);
assert.doesNotMatch(clientHelperSrc, /@\/lib\/cms\//);
assert.doesNotMatch(clientHelperSrc, /topic-blog-draft\.ts/);
assert.doesNotMatch(clientHelperSrc, /node:crypto/);

console.log('lib/admin/research/topic-blog-draft-panel-client-boundary.test.ts: ok');
