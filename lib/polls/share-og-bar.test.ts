import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  POLL_OG_BAR_MIN_TOTAL,
  buildPollOgBarSegments,
  formatPollOgResultsLine,
  pollOgImageAltText,
  showPollOgProportionalBar,
} from './share-og-bar';

test('buildPollOgBarSegments keeps Nei, Blank, Ja order', () => {
  const segments = buildPollOgBarSegments({ nei: 2, blank: 1, ja: 7, total: 10 });
  assert.deepEqual(
    segments.map((segment) => segment.choice),
    ['nei', 'blank', 'ja'],
  );
});

test('formatPollOgResultsLine merges shares and total', () => {
  assert.equal(
    formatPollOgResultsLine({ nei: 24, blank: 6, ja: 30, total: 60 }),
    'Nei 40 % · Blank 10 % · Ja 50 % — 60 stemmer',
  );
});

test('formatPollOgResultsLine handles zero and small samples', () => {
  assert.match(formatPollOgResultsLine({ nei: 0, blank: 0, ja: 0, total: 0 }), /Bli den første til å stemme/);
  assert.match(formatPollOgResultsLine({ nei: 2, blank: 1, ja: 3, total: 6 }), /Få stemmer så langt/);
});

test('pollOgImageAltText includes percentages when sample is large enough', () => {
  assert.equal(
    pollOgImageAltText('Spørsmål', { nei: 24, blank: 6, ja: 30, total: 60 }),
    'Spørsmål – Nei 40 %, Blank 10 %, Ja 50 %',
  );
});

test('showPollOgProportionalBar requires minimum sample', () => {
  assert.equal(showPollOgProportionalBar({ nei: 0, blank: 0, ja: 9, total: 9 }), false);
  assert.equal(showPollOgProportionalBar({ nei: 0, blank: 0, ja: 10, total: 10 }), true);
  assert.equal(POLL_OG_BAR_MIN_TOTAL, 10);
});
