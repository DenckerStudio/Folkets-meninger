import assert from 'node:assert/strict';
import { normalizeAnalyticsPathTemplate } from '@/lib/analytics/path-template';

assert.equal(normalizeAnalyticsPathTemplate(''), '/');
assert.equal(normalizeAnalyticsPathTemplate('/blogg/hei?x=1'), '/blogg/hei');
assert.equal(
  normalizeAnalyticsPathTemplate('/l/11111111-1111-4111-8111-111111111111'),
  '/l/:id',
);
assert.equal(normalizeAnalyticsPathTemplate('/dashboard/sak/103102'), '/dashboard/sak/:id');
assert.equal(normalizeAnalyticsPathTemplate('/api/admin/users'), '/api/admin/*');
assert.equal(normalizeAnalyticsPathTemplate('/_next/static/chunks/main.js'), '/_next/*');
assert.equal(
  normalizeAnalyticsPathTemplate('https://www.folkets-meninger.no/blogg/x#section'),
  '/blogg/x',
);

console.log('lib/analytics/path-template.test.ts ok');
