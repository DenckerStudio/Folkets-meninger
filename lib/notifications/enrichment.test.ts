import assert from 'node:assert/strict';
import {
  buildCategoryAlertBody,
  buildLabelAlertBody,
  prepareDigestForUser,
} from './enrichment';

const plus = {
  subscription_tier: 'stemme_plus',
  subscription_status: 'active',
  subscription_period_end: '2099-01-01T00:00:00.000Z',
};

const free = { subscription_tier: 'free' };

assert.match(
  buildCategoryAlertBody({ title: 'Sak A', category: 'Helse', status: 'Under behandling' }, true),
  /Komitéområde: Helse/,
);
assert.equal(buildCategoryAlertBody({ title: 'Sak A', category: 'Helse' }, false), 'Sak A');

assert.match(buildLabelAlertBody('Sak B', ['klima', 'skatt'], true), /klima, skatt/);
assert.equal(buildLabelAlertBody('Sak B', ['klima'], false), 'Sak B');

const teaser = prepareDigestForUser(
  Array.from({ length: 8 }, (_, i) => ({
    title: `Sak ${i}`,
    body: 'Detalj',
    createdAt: `2026-01-0${i + 1}T10:00:00.000Z`,
    channel: i % 2 === 0 ? 'categories' : 'labels',
  })),
  free,
);
assert.equal(teaser.isTeaser, true);
assert.equal(teaser.items.length, 5);
assert.equal(teaser.groupedByChannel.length, 0);

const full = prepareDigestForUser(
  [
    {
      title: 'Sak 1',
      body: 'Detalj',
      createdAt: '2026-01-01T10:00:00.000Z',
      channel: 'categories',
    },
    {
      title: 'Sak 2',
      body: 'Mer',
      createdAt: '2026-01-02T10:00:00.000Z',
      channel: 'labels',
    },
  ],
  plus,
);
assert.equal(full.isTeaser, false);
assert.equal(full.groupedByChannel.length, 2);
assert.equal(full.groupedByChannel[0]?.items[0]?.body, 'Detalj');

console.log('notifications/enrichment.test.ts: ok');
