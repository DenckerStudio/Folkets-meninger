import assert from 'node:assert/strict';
import { appendResearchFixturePreview } from '@/lib/reddit-signals/preview';

assert.equal(
  appendResearchFixturePreview('/dashboard/admin/research?view=temaer', 'fixture'),
  '/dashboard/admin/research?view=temaer&preview=fixture',
);
assert.equal(
  appendResearchFixturePreview('/dashboard/admin/research', undefined),
  '/dashboard/admin/research',
);

console.log('lib/reddit-signals/preview.test.ts: ok');