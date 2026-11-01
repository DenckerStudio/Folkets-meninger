import assert from 'node:assert/strict';
import { channelBucketLabel } from '@/lib/admin/analytics/channel-labels';

assert.equal(channelBucketLabel('direct'), 'Direkte');
assert.equal(channelBucketLabel('search_google'), 'Google');
assert.equal(channelBucketLabel('social_bluesky'), 'Bluesky');
assert.equal(channelBucketLabel('unknown_bucket'), 'unknown_bucket');

console.log('admin/analytics/channel-labels.test.ts: ok');
