import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildDelSharePageMetadata,
  buildPollDetailPageMetadata,
  buildUtforskReelPollMetadata,
  pollOpenGraphImagePath,
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

test('pollOpenGraphImagePath points at route opengraph-image', () => {
  assert.equal(
    pollOpenGraphImagePath('abc-123'),
    '/dashboard/avstemninger/abc-123/opengraph-image',
  );
});

test('buildPollDetailPageMetadata sets canonical and OG image', () => {
  const metadata = buildPollDetailPageMetadata(samplePoll);
  assert.match(String(metadata.title), /nattåpent apotek/);
  assert.equal(metadata.alternates?.canonical, '/dashboard/avstemninger/abc-123');
  const og = metadata.openGraph as { url?: string; siteName?: string; images?: Array<{ url: string }> };
  assert.equal(og.siteName, SITE_NAME);
  assert.equal(og.url, '/dashboard/avstemninger/abc-123');
  assert.equal(og.images?.[0]?.url, '/dashboard/avstemninger/abc-123/opengraph-image');
  const twitter = metadata.twitter as { card?: string };
  assert.equal(twitter.card, 'summary_large_image');
});

test('buildUtforskReelPollMetadata uses reels canonical with poll image', () => {
  const metadata = buildUtforskReelPollMetadata(samplePoll);
  assert.equal(metadata.alternates?.canonical, '/dashboard/utforsk/reels?poll=abc-123');
  const og = metadata.openGraph as { images?: Array<{ url: string }> };
  assert.equal(og.images?.[0]?.url, '/dashboard/avstemninger/abc-123/opengraph-image');
});

test('buildDelSharePageMetadata includes versioned OG image', () => {
  const metadata = buildDelSharePageMetadata({ poll: samplePoll, pollId: samplePoll.id });
  assert.equal(metadata.alternates?.canonical, '/del/abc-123');
  const og = metadata.openGraph as { images?: Array<{ url: string }> };
  assert.match(og.images?.[0]?.url ?? '', /\/del\/abc-123\/opengraph-image\?v=/);
});
