import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_SITE_URL,
  SITE_NAME,
  buildPageMetadata,
  getMetadataBase,
  getSiteUrl,
  homepageMetadata,
  truncateDescription,
} from './metadata';

const PREV_SITE_URL = process.env.NEXT_PUBLIC_APP_URL;

test('getSiteUrl falls back to the product domain', () => {
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  assert.equal(getSiteUrl(), DEFAULT_SITE_URL);
  assert.equal(getMetadataBase().origin, DEFAULT_SITE_URL);
  if (PREV_SITE_URL) process.env.NEXT_PUBLIC_APP_URL = PREV_SITE_URL;
});

test('buildPageMetadata adds brand suffix, canonical and social tags', () => {
  const metadata = buildPageMetadata({
    title: 'Avstemninger',
    description: 'Beskrivelse',
    canonicalPath: '/dashboard/avstemninger',
  });

  assert.equal(metadata.title, `Avstemninger | ${SITE_NAME}`);
  assert.equal(metadata.alternates?.canonical, '/dashboard/avstemninger');
  const og = metadata.openGraph as {
    title: string;
    type?: string;
    url?: unknown;
    images?: Array<{ url: string }>;
  };
  const twitter = metadata.twitter as { card?: string; title: string };
  assert.equal(og.title, `Avstemninger | ${SITE_NAME}`);
  assert.equal(og.url, '/dashboard/avstemninger');
  assert.equal(og.type, 'website');
  assert.equal(twitter.card, 'summary_large_image');
  assert.equal(twitter.title, `Avstemninger | ${SITE_NAME}`);
  assert.ok(Array.isArray(og.images));
  assert.equal(og.images?.[0].url, '/opengraph-image');
});

test('absoluteTitle skips the brand suffix', () => {
  const metadata = homepageMetadata();
  assert.equal(metadata.title, 'Folkets Meninger — din stemme mellom valgene');
  assert.equal(metadata.alternates?.canonical, '/');
});

test('truncateDescription shortens and keeps the brand from doubling', () => {
  const long = 'A'.repeat(300);
  const truncated = truncateDescription(long, 160);
  assert.ok(truncated.length <= 161);
  assert.ok(truncated.endsWith('…'));
  assert.equal(truncateDescription('Kort tekst', 160), 'Kort tekst');
});