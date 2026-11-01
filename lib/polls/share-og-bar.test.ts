import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  POLL_OG_BAR_MIN_TOTAL,
  buildPollOgBarSegments,
  formatPollOgLegendLine,
  formatPollOgTotalLine,
  showPollOgProportionalBar,
} from './share-og-bar';

test('buildPollOgBarSegments keeps Nei, Blank, Ja order', () => {
  const segments = buildPollOgBarSegments({ nei: 2, blank: 1, ja: 7, total: 10 });
  assert.deepEqual(
    segments.map((segment) => segment.choice),
    ['nei', 'blank', 'ja'],
  );
  assert.equal(segments[0].percent, 20);
  assert.equal(segments[1].percent, 10);
  assert.equal(segments[2].percent, 70);
});

test('formatPollOgLegendLine lists choices once', () => {
  const legend = formatPollOgLegendLine({ nei: 12, blank: 3, ja: 45, total: 60 });
  assert.equal(legend, 'Nei 12 · Blank 3 · Ja 45');
});

test('showPollOgProportionalBar requires minimum sample', () => {
  assert.equal(showPollOgProportionalBar({ nei: 0, blank: 0, ja: 9, total: 9 }), false);
  assert.equal(showPollOgProportionalBar({ nei: 0, blank: 0, ja: 10, total: 10 }), true);
  assert.equal(POLL_OG_BAR_MIN_TOTAL, 10);
});

test('formatPollOgTotalLine uses small-sample and empty copy', () => {
  assert.equal(formatPollOgTotalLine({ nei: 0, blank: 0, ja: 0, total: 0 }), 'Bli den første til å stemme');
  assert.equal(formatPollOgTotalLine({ nei: 2, blank: 1, ja: 3, total: 6 }), 'Få stemmer så langt');
  assert.equal(formatPollOgTotalLine({ nei: 12, blank: 3, ja: 45, total: 60 }), '60 stemmer');
  assert.equal(formatPollOgTotalLine({ nei: 1, blank: 0, ja: 0, total: 1 }), 'Få stemmer så langt');
});

test('buildPollOgBarSegments uses Nei red, Blank white, Ja blue', () => {
  const segments = buildPollOgBarSegments({ nei: 1, blank: 1, ja: 1, total: 3 });
  assert.equal(segments[0].background, '#ba0c2f');
  assert.equal(segments[1].background, '#ffffff');
  assert.equal(segments[2].background, '#0a3d9e');
});
