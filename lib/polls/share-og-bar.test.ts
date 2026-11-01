import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPollOgBarSegments, formatPollOgVoteSummary } from './share-og-bar';

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

test('formatPollOgVoteSummary mentions stemmer', () => {
  const summary = formatPollOgVoteSummary({ nei: 1, blank: 0, ja: 4, total: 5 });
  assert.match(summary, /5 stemmer/);
  assert.match(summary, /Nei 1/);
});

test('formatPollOgVoteSummary handles zero votes', () => {
  const summary = formatPollOgVoteSummary({ nei: 0, blank: 0, ja: 0, total: 0 });
  assert.match(summary, /Ingen stemmer ennå/);
});

test('buildPollOgBarSegments uses Nei red, Blank white, Ja blue', () => {
  const segments = buildPollOgBarSegments({ nei: 1, blank: 1, ja: 1, total: 3 });
  assert.equal(segments[0].background, '#ba0c2f');
  assert.equal(segments[1].background, '#ffffff');
  assert.equal(segments[2].background, '#0a3d9e');
});
