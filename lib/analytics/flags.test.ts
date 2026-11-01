import assert from 'node:assert/strict';
import { isAnalyticsEnabled, isUmamiEnabled } from '@/lib/analytics/flags';

process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = 'true';
process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID = 'test-id';
process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL =
  'https://analytics.folkets-meninger.no/script.js';
assert.equal(isAnalyticsEnabled(), true);
assert.equal(isUmamiEnabled(), true);

delete process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
assert.equal(isUmamiEnabled(), false);

console.log('lib/analytics/flags.test.ts ok');
