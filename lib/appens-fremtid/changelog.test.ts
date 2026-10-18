import assert from 'node:assert/strict';
import {
  CHANGELOG_DRAFT_PUBLISHED_AT,
  changelogPublishLabel,
  isChangelogPublished,
} from '@/lib/appens-fremtid/changelog';
import type { ChangelogEntry } from '@/lib/appens-fremtid/constants';

const published: ChangelogEntry = {
  id: '1',
  title: 'T',
  body: 'Body long enough',
  createdAt: '2026-01-01T00:00:00.000Z',
  publishedAt: '2026-01-01T00:00:00.000Z',
};

const draft: ChangelogEntry = {
  ...published,
  id: '2',
  publishedAt: CHANGELOG_DRAFT_PUBLISHED_AT,
};

assert.equal(isChangelogPublished(published), true);
assert.equal(isChangelogPublished(draft), false);
assert.equal(changelogPublishLabel(published), 'Publisert');
assert.equal(changelogPublishLabel(draft), 'Utkast');

console.log('appens-fremtid/changelog.test.ts: ok');
