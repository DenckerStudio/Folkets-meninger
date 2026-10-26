import assert from 'node:assert/strict';
import {
  changelogDisplayWhen,
  changelogPublishLabel,
  isChangelogPublished,
} from '@/lib/appens-fremtid/changelog';
import type { ChangelogEntry } from '@/lib/appens-fremtid/constants';

const published: ChangelogEntry = {
  id: '1',
  title: 'T',
  body: 'Body long enough',
  createdAt: '2026-01-01T00:00:00.000Z',
  publishedAt: '2026-01-02T00:00:00.000Z',
  publicationStatus: 'published',
};

const draft: ChangelogEntry = {
  ...published,
  id: '2',
  publishedAt: null,
  publicationStatus: 'draft',
};

assert.equal(isChangelogPublished(published), true);
assert.equal(isChangelogPublished(draft), false);
assert.equal(changelogPublishLabel(published), 'Publisert');
assert.equal(changelogPublishLabel(draft), 'Utkast');
assert.equal(changelogDisplayWhen(draft), draft.createdAt);
assert.equal(changelogDisplayWhen(published), published.publishedAt);

console.log('appens-fremtid/changelog.test.ts: ok');
