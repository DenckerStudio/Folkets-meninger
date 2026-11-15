import assert from 'node:assert/strict';
import {
  buildWeeklyOverviewDigestHtmlBlock,
  buildWeeklyOverviewDigestPlainBlock,
  isWeeklyOverviewDigestEnabled,
  mergeWeeklyOverviewIntoDigestBody,
  weeklyOverviewHasDigestContent,
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

const emptyOverview = buildEmptyWeeklyOverview(new Date('2026-11-15T12:00:00.000Z'));
assert.equal(weeklyOverviewHasDigestContent(emptyOverview), false);
assert.equal(buildWeeklyOverviewDigestPlainBlock(emptyOverview), null);

const overview = {
  ...emptyOverview,
  votingSoon: [
    {
      issueId: '200501',
      title: 'Test',
      href: '/dashboard/sak/200501',
      votingClosesAt: null,
      daysLeftLabel: '2 dager',
    },
  ],
};
assert.equal(weeklyOverviewHasDigestContent(overview), true);

const pageUrl = 'https://www.folkets-meninger.no/denne-uka';
const plain = buildWeeklyOverviewDigestPlainBlock(overview);
assert.ok(plain);
assert.match(plain, /Dette skjer nå/);
assert.match(plain, /Siste 7 dager/);
assert.match(plain, /Neste 7 dager/);
assert.match(plain, /nær votering \(Neste 7 dager /);
assert.doesNotMatch(plain, /neste 7 dager/);
assert.doesNotMatch(plain, /https?:\/\//);
assert.doesNotMatch(plain, /• 0 /);
assert.doesNotMatch(plain, /spørsmålstekst/i);
assert.match(plain, /«Dette skjer nå»/);

const merged = mergeWeeklyOverviewIntoDigestBody('Varsellinje', plain);
assert.match(merged, /Varsellinje/);
assert.match(merged, /Dette skjer nå/);
assert.equal(mergeWeeklyOverviewIntoDigestBody('Kun varsler', null), 'Kun varsler');

const html = buildWeeklyOverviewDigestHtmlBlock(pageUrl, overview);
assert.match(html, /Åpne «Dette skjer nå»/);
assert.match(html, /folkets-meninger\.no\/denne-uka/);
assert.doesNotMatch(html, /Les hele ukeoversikten på siden/);

console.log('lib/notifications/digest-weekly-overview.test.ts: ok');