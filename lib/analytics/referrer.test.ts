import assert from 'node:assert/strict';
import { classifyReferrer } from '@/lib/analytics/referrer';

assert.equal(
  classifyReferrer({ utmSource: 'facebook' }).bucket,
  'social_facebook',
);
assert.equal(
  classifyReferrer({ referrerUrl: 'https://www.google.com/search?q=test' }).bucket,
  'search_google',
);
assert.equal(classifyReferrer({}).bucket, 'direct');

assert.equal(classifyReferrer({ utmSource: 'sms' }).bucket, 'other');
assert.equal(
  classifyReferrer({ referrerUrl: 'https://www.google.no/search?q=test' }).bucket,
  'search_google',
);
assert.equal(
  classifyReferrer({
    utmSource: 'facebook',
    referrerUrl: 'https://www.google.com/search?q=test',
  }).bucket,
  'social_facebook',
);
assert.equal(
  classifyReferrer({ referrerUrl: 'https://www.folkets-meninger.no/dashboard' }).bucket,
  'direct',
);

console.log('referrer.test.ts ok');
