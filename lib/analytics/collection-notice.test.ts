import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ANALYTICS_COLLECTION_DISABLED_BODY,
  ANALYTICS_COLLECTION_DISABLED_TITLE,
  ANALYTICS_FOOTER_NOTICE,
} from '@/lib/analytics/collection-notice';

assert.equal(ANALYTICS_COLLECTION_DISABLED_TITLE, 'Besøkstelling er slått av');
assert.match(ANALYTICS_COLLECTION_DISABLED_BODY, /besøksanalyse er av/i);
assert.match(ANALYTICS_FOOTER_NOTICE, /teller besøk anonymt/i);

const footer = readFileSync(join(process.cwd(), 'components/landing-footer.tsx'), 'utf8');
assert.match(footer, /isAnalyticsEnabled\(\)/);
assert.match(footer, /showAnalyticsNotice/);
assert.doesNotMatch(footer, /Vi teller besøk anonymt på vår egen server\.\{' '\}/);

const statistikkClient = readFileSync(
  join(process.cwd(), 'app/dashboard/admin/statistikk/admin-statistikk-client.tsx'),
  'utf8',
);
assert.match(statistikkClient, /isAnalyticsEnabled\(\)/);
assert.match(statistikkClient, /AnalyticsCollectionDisabled/);
assert.match(statistikkClient, /VURDER_FOCUS_RING/);
assert.match(statistikkClient, /text-brand-foreground/);
assert.doesNotMatch(statistikkClient, /bg-brand text-white/);

const personalShare = readFileSync(
  join(process.cwd(), 'components/share/personal-share-panel.tsx'),
  'utf8',
);
assert.match(personalShare, /min-h-11/);
assert.match(personalShare, /VURDER_FOCUS_RING/);

const trafficTable = readFileSync(
  join(process.cwd(), 'components/admin/analytics/traffic-table.tsx'),
  'utf8',
);
assert.match(trafficTable, /!collectionEnabled/);
assert.match(trafficTable, /AnalyticsCollectionDisabled/);

console.log('lib/analytics/collection-notice.test.ts: ok');
