import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildDisabledDelSharePageMetadata } from '@/lib/polls/page-metadata';
import { SYSTEM_POLL_SHARE_RETIRED_TITLE } from '@/lib/polls/system-reels-retired';
import { DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE_PATH, SITE_NAME } from '@/lib/seo/metadata';
import { isPublicSharePollRouteEnabled } from '@/lib/polls/del-share-route';

const pageSrc = readFileSync(join(process.cwd(), 'app/del/[id]/page.tsx'), 'utf8');
const ogSrc = readFileSync(join(process.cwd(), 'app/del/[id]/opengraph-image.tsx'), 'utf8');
const twitterSrc = readFileSync(join(process.cwd(), 'app/del/[id]/twitter-image.tsx'), 'utf8');
const retiredSrc = readFileSync(
  join(process.cwd(), 'components/polls/share-poll-retired.tsx'),
  'utf8',
);

test('public share poll route gate matches flag or admin', () => {
  assert.equal(
    isPublicSharePollRouteEnabled({ sharePollsEnabled: true, isAdminUser: false }),
    true,
  );
  assert.equal(
    isPublicSharePollRouteEnabled({ sharePollsEnabled: false, isAdminUser: true }),
    true,
  );
  assert.equal(
    isPublicSharePollRouteEnabled({ sharePollsEnabled: false, isAdminUser: false }),
    false,
  );
});

test('buildDisabledDelSharePageMetadata is neutral and noindex', () => {
  const metadata = buildDisabledDelSharePageMetadata();
  assert.equal(metadata.title, SITE_NAME);
  assert.equal(metadata.description, DEFAULT_DESCRIPTION);
  assert.deepEqual(metadata.robots, { index: false, follow: false });
  assert.equal(metadata.alternates?.canonical, undefined);
  const og = metadata.openGraph as { title?: string; images?: Array<{ url: string }> };
  assert.equal(og.title, SITE_NAME);
  assert.equal(og.images?.[0]?.url, DEFAULT_OG_IMAGE_PATH);
  assert.doesNotMatch(String(metadata.title), new RegExp(SYSTEM_POLL_SHARE_RETIRED_TITLE));
});

test('del share page gates metadata before resolving poll', () => {
  assert.match(pageSrc, /isPublicSharePollRouteEnabledForRequest/);
  assert.match(pageSrc, /buildDisabledDelSharePageMetadata/);
  const metadataBlock = pageSrc.slice(
    pageSrc.indexOf('export async function generateMetadata'),
    pageSrc.indexOf('export default async function SharePollPage'),
  );
  assert.match(metadataBlock, /if \(!enabled\)/);
  assert.ok(
    metadataBlock.indexOf('if (!enabled)') <
      metadataBlock.indexOf('resolvePublicPollSharePage'),
    'generateMetadata must gate before resolving poll',
  );
});

test('del share OG routes gate before loading poll', () => {
  for (const src of [ogSrc, twitterSrc]) {
    assert.match(src, /isPublicSharePollRouteEnabledForRequest/);
    assert.match(src, /notFound\(\)/);
    const body = src.slice(src.indexOf('export default async function Image'));
    const gate = body.indexOf('isPublicSharePollRouteEnabledForRequest');
    const loadPoll = body.indexOf('getPublicPollById');
    assert.ok(gate >= 0 && loadPoll >= 0 && gate < loadPoll);
  }
});

assert.match(pageSrc, /resolvePublicPollSharePage/);
assert.match(pageSrc, /SharePollRetiredPage/);
assert.match(pageSrc, /buildRetiredDelSharePageMetadata/);

assert.match(retiredSrc, /PollRetiredNotice/);

console.log('polls/del-share-route.test.ts: ok');
