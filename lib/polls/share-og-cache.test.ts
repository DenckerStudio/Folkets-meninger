import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  OG_IMAGE_CACHE_CONTROL,
  OG_IMAGE_REVALIDATE_SECONDS,
} from '@/lib/polls/share-og';
import { SHARE_OG_LIVE_CACHE_CONTROL, SHARE_OG_REVALIDATE_SECONDS } from '@/lib/seo/share-og';

test('live OG cache uses ~300s revalidate and short Cache-Control', () => {
  assert.equal(SHARE_OG_REVALIDATE_SECONDS, 300);
  assert.equal(OG_IMAGE_REVALIDATE_SECONDS, 300);
  assert.equal(OG_IMAGE_CACHE_CONTROL, SHARE_OG_LIVE_CACHE_CONTROL);
  assert.match(SHARE_OG_LIVE_CACHE_CONTROL, /max-age=300/);
  assert.match(SHARE_OG_LIVE_CACHE_CONTROL, /s-maxage=300/);
});
