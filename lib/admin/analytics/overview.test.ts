import assert from 'node:assert/strict';
import {
  analyticsOverviewNotReady,
  isMissingAnalyticsRpc,
  mapAdminAnalyticsOverview,
} from '@/lib/admin/analytics/overview';

assert.equal(isMissingAnalyticsRpc({ code: 'PGRST202' }), true);
assert.equal(isMissingAnalyticsRpc({ message: 'function does not exist' }), true);
assert.equal(isMissingAnalyticsRpc({ message: '42883: no function matches' }), true);
assert.equal(isMissingAnalyticsRpc({ code: '22023', message: 'bad input' }), false);
assert.equal(isMissingAnalyticsRpc(null), false);

const mapped = mapAdminAnalyticsOverview({
  userMetrics: {
    totalRegistered: 100,
    newLast7Days: 5,
    signedInLast30Days: 40,
    inactiveApprox: 10,
    inactiveDaysThreshold: 90,
    stemmePlus: 3,
  },
  shareLinks: {
    links: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        code: 'abc123',
        target_kind: 'poll',
        target_id: 'poll-1',
        label: null,
        created_at: '2026-11-01T12:00:00.000Z',
        creator_email: 'admin@example.com',
        clicks: 7,
      },
    ],
  },
  trafficOverview: {
    pageViews: 1000,
    uniqueVisitors: 200,
    pollLandings: 50,
    shareClicks: 12,
    topPaths: [{ path: '/dashboard/utforsk', views: 400 }],
    channels: [{ bucket: 'direct', views: 300 }],
    blogPaths: [{ path: '/blogg/foo', views: 20 }],
  },
});

assert.equal(mapped.ready, true);
assert.equal(mapped.user?.totalRegistered, 100);
assert.equal(mapped.user?.stemmePlus, 3);
assert.equal(mapped.links.length, 1);
assert.equal(mapped.links[0]?.targetKind, 'poll');
assert.equal(mapped.links[0]?.creatorEmail, 'admin@example.com');
assert.equal(mapped.links[0]?.clicks, 7);
assert.equal(mapped.traffic?.pageViews, 1000);
assert.equal(mapped.traffic?.topPaths[0]?.path, '/dashboard/utforsk');
assert.equal(mapped.traffic?.channels[0]?.bucket, 'direct');
assert.equal(mapped.traffic?.blogPaths[0]?.views, 20);

assert.deepEqual(analyticsOverviewNotReady, {
  ready: false,
  user: null,
  links: [],
  traffic: null,
});

console.log('admin/analytics/overview.test.ts: ok');
