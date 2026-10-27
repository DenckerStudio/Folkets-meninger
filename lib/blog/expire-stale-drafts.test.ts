import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { postsEligibleForBlogDraftExpiry } from '@/lib/blog/expire-stale-drafts';
import type { PayloadPost } from '@/lib/cms/types';

const routeSrc = readFileSync(
  join(process.cwd(), 'app/api/ops/blog/expire-drafts/route.ts'),
  'utf-8',
);

assert.match(routeSrc, /verifyOpsSecret\(request\)/);
assert.match(routeSrc, /expireStaleBlogDrafts/);
assert.match(routeSrc, /dryRun/);

const oldCreated = '2026-10-20T12:00:00.000Z';
const nowMs = Date.parse('2026-10-24T13:00:00.000Z');

const staleDraft: PayloadPost = {
  id: '1',
  slug: 'a',
  title: 'A',
  excerpt: 'E',
  bodyMarkdown: 'b',
  _status: 'draft',
  createdAt: oldCreated,
  review: { state: 'til_vurdering' },
};

const published: PayloadPost = {
  ...staleDraft,
  id: '2',
  _status: 'published',
};

const fresh: PayloadPost = {
  ...staleDraft,
  id: '3',
  createdAt: '2026-10-24T12:00:00.000Z',
};

const alreadyExpired: PayloadPost = {
  ...staleDraft,
  id: '4',
  expiredAt: '2026-10-24T12:00:00.000Z',
};

const restoredStale: PayloadPost = {
  ...staleDraft,
  id: '5',
  restoredAt: '2026-10-24T12:00:00.000Z',
};

const eligible = postsEligibleForBlogDraftExpiry(
  [staleDraft, published, fresh, alreadyExpired, restoredStale],
  nowMs,
);
assert.deepEqual(eligible.map((p) => p.id), ['1']);

console.log('lib/blog/expire-stale-drafts.test.ts: ok');
