import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildDelSharePageMetadata,
  buildPollDetailPageMetadata,
  pollOgImageVersionFromTotals,
  pollOpenGraphImagePath,
  pollOpenGraphImageUrl,
} from './page-metadata';
import { SITE_NAME } from '@/lib/seo/metadata';
import type { PollRecord } from '@/lib/polls/types';

const samplePoll: PollRecord = {
  id: 'abc-123',
  track: 'system',
  status: 'open',
  title: 'Bør Norge innføre nattåpent apotek?',
  neutralSummary: 'Kort oppsummert spørsmål om helsepolitikk.',
  sourceUrls: [],
  stortingetIssueId: '104123',
  citizenInitiativeId: null,
  opensAt: null,
  closesAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  expiredAt: null,
  restoredAt: null,
  generationMetadata: {},
};

const sampleTotals = { nei: 12, blank: 3, ja: 45, total: 60 };

test('pollOpenGraphImagePath points at route opengraph-image', () => {
  assert.equal(
    pollOpenGraphImagePath('abc-123'),
    '/dashboard/avstemninger/abc-123/opengraph-image',
  );
});

test('pollOgImageVersionFromTotals changes when counts change', () => {
  const a = pollOgImageVersionFromTotals({ nei: 1, blank: 0, ja: 2, total: 3 });
  const b = pollOgImageVersionFromTotals({ nei: 1, blank: 0, ja: 3, total: 4 });
  assert.notEqual(a, b);
  assert.match(a, /^[a-f0-9]{12}$/);
});

test('buildPollDetailPageMetadata versions OG image from totals', () => {
  const metadata = buildPollDetailPageMetadata(samplePoll, sampleTotals);
  assert.match(String(metadata.title), /nattåpent apotek/);
  assert.equal(metadata.alternates?.canonical, '/dashboard/avstemninger/abc-123');
  const og = metadata.openGraph as { url?: string; siteName?: string; images?: Array<{ url: string }> };
  assert.equal(og.siteName, SITE_NAME);
  assert.equal(og.url, '/dashboard/avstemninger/abc-123');
  assert.equal(
    og.images?.[0]?.url,
    `${pollOpenGraphImageUrl('abc-123', sampleTotals)}`,
  );
  const twitter = metadata.twitter as { card?: string };
  assert.equal(twitter.card, 'summary_large_image');
});

test('buildDelSharePageMetadata versions del OG image from totals', () => {
  const metadata = buildDelSharePageMetadata({
    poll: samplePoll,
    pollId: samplePoll.id,
    totals: sampleTotals,
  });
  assert.equal(metadata.alternates?.canonical, '/del/abc-123');
  const og = metadata.openGraph as { images?: Array<{ url: string }> };
  assert.match(
    og.images?.[0]?.url ?? '',
    new RegExp(
      `/del/abc-123/opengraph-image\\?v=${pollOgImageVersionFromTotals(sampleTotals)}`,
    ),
  );
});
