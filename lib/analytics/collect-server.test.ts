import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  buildAnalyticsInsertRow,
  computeSessionHash,
  parseCollectPayload,
} from '@/lib/analytics/collect-server';

const baseContext = {
  ip: '203.0.113.10',
  userAgent: 'TestAgent/1.0',
  utcDate: '2026-11-01',
};

assert.equal(parseCollectPayload(null).ok, false);
assert.equal(parseCollectPayload({ eventName: 'nope', path: '/x' }).ok, false);
assert.equal(parseCollectPayload({ eventName: 'page_view', path: 'no-slash' }).ok, false);
assert.equal(
  parseCollectPayload({ eventName: 'page_view', path: `/${'a'.repeat(499)}` }).ok,
  true,
);
assert.equal(
  parseCollectPayload({ eventName: 'page_view', path: `/${'a'.repeat(500)}` }).ok,
  false,
);

const parsed = parseCollectPayload({
  eventName: 'share_link_click',
  path: '  /dashboard/utforsk  ',
  referrer: 'https://www.google.com/search?q=secret',
  utmSource: '  facebook  ',
  utmMedium: 'social',
  ref: 'abc',
});
assert.equal(parsed.ok, true);
if (!parsed.ok) throw new Error('expected ok');
assert.equal(parsed.value.path, '/dashboard/utforsk');
assert.equal(parsed.value.referrerHost, 'www.google.com');
assert.equal(parsed.value.utmSource, 'facebook');
assert.equal(parsed.value.metadata.bucket, 'social_facebook');

assert.equal(
  parseCollectPayload({
    eventName: 'poll_share_landing',
    path: '/del/x',
    referrer: 'not-a-url',
  }).ok,
  true,
);
const badRef = parseCollectPayload({
  eventName: 'page_view',
  path: '/',
  referrer: 'not-a-url',
});
assert.equal(badRef.ok, true);
if (!badRef.ok) throw new Error('expected ok');
assert.equal(badRef.value.referrerHost, null);

assert.equal(computeSessionHash({ ...baseContext, secret: undefined }), null);
assert.equal(computeSessionHash({ ...baseContext, secret: '' }), null);

const hash1 = computeSessionHash({ ...baseContext, secret: 's3cret' });
assert.ok(hash1);
assert.notEqual(hash1, baseContext.ip);
assert.equal(hash1!.length, 64);

const hashOtherDay = computeSessionHash({
  ...baseContext,
  secret: 's3cret',
  utcDate: '2026-11-02',
});
assert.notEqual(hash1, hashOtherDay);

const expected = createHash('sha256')
  .update(`s3cret|${baseContext.ip}|${baseContext.userAgent}|${baseContext.utcDate}`)
  .digest('hex');
assert.equal(hash1, expected);

const row = buildAnalyticsInsertRow({
  payload: parsed.value,
  shareLinkId: '11111111-1111-1111-1111-111111111111',
  sessionHash: hash1,
});
assert.equal(row.event_name, 'share_link_click');
assert.equal(row.path, '/dashboard/utforsk');
assert.equal(row.referrer_host, 'www.google.com');
assert.equal(row.utm_source, 'facebook');
assert.equal(row.ref_code, 'abc');
assert.equal(row.share_link_id, '11111111-1111-1111-1111-111111111111');
assert.equal(row.session_hash, hash1);
assert.deepEqual(row.metadata, { bucket: 'social_facebook' });
assert.equal('referrer' in row, false);

console.log('collect-server.test.ts ok');
