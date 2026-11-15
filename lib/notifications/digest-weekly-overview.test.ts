import assert from 'node:assert/strict';
import {
  buildWeeklyOverviewDigestHtmlBlock,
  buildWeeklyOverviewDigestPlainBlock,
  isWeeklyOverviewDigestEnabled,
  mergeWeeklyOverviewIntoDigestBody,
} from './digest';
import { buildEmptyWeeklyOverview } from '@/lib/weekly-overview';

const original = process.env.WEEKLY_OVERVIEW_DIGEST_ENABLED;
process.env.WEEKLY_OVERVIEW_DIGEST_ENABLED = 'false';
assert.equal(isWeeklyOverviewDigestEnabled(), false);
process.env.WEEKLY_OVERVIEW_DIGEST_ENABLED = 'true';
assert.equal(isWeeklyOverviewDigestEnabled(), true);
process.env.WEEKLY_OVERVIEW_DIGEST_ENABLED = '1';
assert.equal(isWeeklyOverviewDigestEnabled(), false);
if (original === undefined) {
  delete process.env.WEEKLY_OVERVIEW_DIGEST_ENABLED;
} else {
  process.env.WEEKLY_OVERVIEW_DIGEST_ENABLED = original;
}

const overview = buildEmptyWeeklyOverview(new Date('2026-11-15T12:00:00.000Z'));
const pageUrl = 'https://www.folkets-meninger.no/denne-uka';
const plain = buildWeeklyOverviewDigestPlainBlock(overview, pageUrl);

assert.match(plain, /Dette skjer nå/);
assert.match(plain, /Siste 7 dager/);
assert.match(plain, /Neste 7 dager/);
assert.match(plain, /denne-uka/);
assert.doesNotMatch(plain, /• 0 /);
assert.doesNotMatch(plain, /spørsmålstekst/i);

const merged = mergeWeeklyOverviewIntoDigestBody('Varsellinje', plain);
assert.match(merged, /Varsellinje/);
assert.match(merged, /Dette skjer nå/);
assert.equal(mergeWeeklyOverviewIntoDigestBody('Kun varsler', null), 'Kun varsler');

const html = buildWeeklyOverviewDigestHtmlBlock(plain, pageUrl);
assert.match(html, /Åpne ukeoversikten/);
assert.match(html, /folkets-meninger\.no\/denne-uka/);

console.log('lib/notifications/digest-weekly-overview.test.ts: ok');