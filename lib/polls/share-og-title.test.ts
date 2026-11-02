import assert from 'node:assert/strict';
import React from 'react';
import { test } from 'node:test';
import type { PollRecord } from '@/lib/polls/types';
import {
  isNotDefGlyph,
  loadPollOgTitleMeasurer,
  loadPollOgTitleMeasurerFonts,
  maxPollOgTitleLineWidth,
  POLL_OG_TITLE_MAX_LINES,
  POLL_OG_TITLE_MAX_WIDTH,
  resetPollOgTitleMeasurerCacheForTests,
} from '@/lib/polls/share-og-title-measure';
import {
  buildPollOgTitleRenderLines,
  OG_IMAGE_SIZE,
  POLL_OG_TITLE_RAW_MAX,
  POLL_OG_TITLE_TO_BAR_EXTRA_GAP_PX,
  clampPollOgText,
  pollOgTitleEndsWithWordBoundaryEllipsis,
  renderPollShareOgImage,
  resolvePollOgTitleDisplay,
  resolvePollOgTitleDisplayWithMeasurer,
  shouldShowPollOgNeutralSummary,
  type PollOgTitleLayout,
} from '@/lib/polls/share-og';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const TITLE_84_CHARS =
  'Skal staten innføre nye avgiftsregler for næringsliv og privatpersoner i hele landet';

const TITLE_90_CHARS =
  'Skal staten innføre nye avgiftsregler for næringsliv og privatpersoner i hele landet snart';

const TITLE_ALL_CAPS =
  'SKAL STATEN INNFØRE NYE AVGIFTSREGLER FOR NÆRINGSLIV OG PRIVATPERSONER I HELE LANDET SNART';

const TITLE_WORST_AEOEAA =
  'Bør æøå ÆØÅ innføre nye avgiftsregler for næringsliv og privatpersoner i hele landet snart';

const TITLE_LONG_WORD = `Skal ${'M'.repeat(120)} vurderes av Stortinget?`;

const TITLE_MAX_RAW = 'W'.repeat(POLL_OG_TITLE_RAW_MAX);

const MEASURED_STRINGS = [
  TITLE_84_CHARS,
  TITLE_90_CHARS,
  TITLE_ALL_CAPS,
  TITLE_WORST_AEOEAA,
  TITLE_LONG_WORD,
  TITLE_MAX_RAW,
  'æøå ÆØÅ',
];

async function withMeasurer() {
  resetPollOgTitleMeasurerCacheForTests();
  return loadPollOgTitleMeasurer();
}

function assertPollOgTitleRenderModel(
  measurer: Awaited<ReturnType<typeof withMeasurer>>,
  layout: PollOgTitleLayout,
) {
  assert.ok(layout.titleLines.length >= 1);
  assert.ok(layout.titleLines.length <= POLL_OG_TITLE_MAX_LINES);
  assert.deepEqual(
    layout.titleLines,
    buildPollOgTitleRenderLines(layout.title, layout.fontSize, measurer),
  );
  for (const line of layout.titleLines) {
    assert.ok(
      measurer.measureWidth(line, layout.fontSize) <= POLL_OG_TITLE_MAX_WIDTH + 0.5,
      `render line wider than ${POLL_OG_TITLE_MAX_WIDTH}px: ${JSON.stringify(line)}`,
    );
  }
}

function assertMeasuredTwoLineTitle(
  measurer: Awaited<ReturnType<typeof withMeasurer>>,
  layout: PollOgTitleLayout,
) {
  assertPollOgTitleRenderModel(measurer, layout);
  assert.ok(
    layout.titleLines.length <= POLL_OG_TITLE_MAX_LINES,
    `title must fit on ${POLL_OG_TITLE_MAX_LINES} rendered lines: ${JSON.stringify(layout.titleLines)}`,
  );
  if (/\s/.test(layout.title)) {
    assert.ok(
      pollOgTitleEndsWithWordBoundaryEllipsis(layout.title),
      `title ellipsis must be on word boundary: ${JSON.stringify(layout.title)}`,
    );
  }
  if (layout.title.endsWith('…')) {
    assert.match(layout.title, /\S…$/);
    assert.ok(
      maxPollOgTitleLineWidth(layout.title, layout.fontSize, measurer) <= POLL_OG_TITLE_MAX_WIDTH + 0.5,
      `line width must stay within ${POLL_OG_TITLE_MAX_WIDTH}px`,
    );
  }
  assert.ok(!measurer.hasNotDefGlyph(layout.title));
}

test('title-to-bar spacing constant is within requested 8–16px band', () => {
  assert.equal(POLL_OG_TITLE_TO_BAR_EXTRA_GAP_PX, 12);
});

test('dual-font measurer uses latin-700 widths (not .notdef counting)', async () => {
  const measurer = await withMeasurer();
  const { latin700, latinExt700 } = await loadPollOgTitleMeasurerFonts();

  assert.ok(measurer.measureWidth('iiii', 46) < measurer.measureWidth('MMMM', 46));

  for (const sample of MEASURED_STRINGS) {
    assert.ok(!measurer.hasNotDefGlyph(sample), `unexpected .notdef in ${JSON.stringify(sample)}`);
  }

  for (const char of 'æøåÆØÅ') {
    assert.ok(!isNotDefGlyph(latin700, char), `${char} should exist in latin-700`);
    assert.ok(isNotDefGlyph(latinExt700, char), `${char} should not be measured from latin-ext alone`);
  }

  assert.equal(TITLE_84_CHARS.length, 84);
  assert.ok(measurer.fitsTwoLines(TITLE_84_CHARS, 46));
  assert.ok(!measurer.fitsTwoLines(TITLE_ALL_CAPS, 46));
});

test('84-, 90-, caps, max-length, æøå and long-word titles resolve on word boundaries', async () => {
  const measurer = await withMeasurer();

  for (const raw of [
    TITLE_84_CHARS,
    TITLE_90_CHARS,
    TITLE_ALL_CAPS,
    TITLE_MAX_RAW,
    TITLE_WORST_AEOEAA,
    TITLE_LONG_WORD,
  ]) {
    const layout = resolvePollOgTitleDisplayWithMeasurer(raw, measurer);
    assertMeasuredTwoLineTitle(measurer, layout);
  }

  const at84 = resolvePollOgTitleDisplayWithMeasurer(TITLE_84_CHARS, measurer);
  assert.equal(at84.fontSize, 46);
  assert.equal(at84.title, TITLE_84_CHARS);

  const caps = resolvePollOgTitleDisplayWithMeasurer(TITLE_ALL_CAPS, measurer);
  assert.equal(caps.fontSize, 40);
  assert.ok(caps.title.endsWith('…'));

  const at90 = resolvePollOgTitleDisplayWithMeasurer(TITLE_90_CHARS, measurer);
  assert.equal(at90.fontSize, 40);

  const maxRaw = resolvePollOgTitleDisplayWithMeasurer(TITLE_MAX_RAW, measurer);
  assert.ok(maxRaw.title.endsWith('…'));
  assert.equal(maxRaw.titleLines.length, 2);
  assert.ok(maxRaw.titleLines.at(-1)?.endsWith('…'));
  assert.ok(
    maxPollOgTitleLineWidth(maxRaw.title, maxRaw.fontSize, measurer) <= POLL_OG_TITLE_MAX_WIDTH,
  );
});

test('130 W title uses two explicit render lines with ellipsis on line 2', async () => {
  const measurer = await withMeasurer();
  const layout = resolvePollOgTitleDisplayWithMeasurer(TITLE_MAX_RAW, measurer);
  assertPollOgTitleRenderModel(measurer, layout);
  assert.equal(layout.titleLines.length, 2);
  assert.ok(layout.titleLines[1]!.endsWith('…'));
  assert.ok(!layout.titleLines[0]!.includes('…'));
  assert.ok(layout.title.endsWith('…'));
});

test('neutral summary only when fitted title is a single rendered line', async () => {
  const measurer = await withMeasurer();
  const oneLine = resolvePollOgTitleDisplayWithMeasurer('Kortere arbeidsuke?', measurer);
  assert.equal(oneLine.titleLines.length, 1);
  assert.ok(shouldShowPollOgNeutralSummary(oneLine.titleLines, 'Eksempel ingress.'));

  const twoLine = resolvePollOgTitleDisplayWithMeasurer(TITLE_90_CHARS, measurer);
  assert.equal(twoLine.titleLines.length, 2);
  assert.ok(!shouldShowPollOgNeutralSummary(twoLine.titleLines, 'Skjult ingress.'));
});

test('clampPollOgText adds ellipsis on hard cut (no spaces)', () => {
  assert.ok(clampPollOgText('W'.repeat(130), 40).endsWith('…'));
  const long = `${'Skal staten '.repeat(20)}avslutning`;
  const clamped = clampPollOgText(long, 96);
  assert.ok(pollOgTitleEndsWithWordBoundaryEllipsis(clamped));
  assert.ok(clamped.endsWith('…'));
});

test('sample titles render 1200×630 OG PNGs', async () => {
  for (const [id, title] of [
    ['og-title-84', TITLE_84_CHARS],
    ['og-title-90', TITLE_90_CHARS],
    ['og-title-caps', TITLE_ALL_CAPS],
    ['og-title-max', TITLE_MAX_RAW],
    ['og-title-aegoesaa', TITLE_WORST_AEOEAA],
    ['og-title-long-word', TITLE_LONG_WORD],
  ] as const) {
    const layout = await resolvePollOgTitleDisplay(title);
    const measurer = await withMeasurer();
    assertMeasuredTwoLineTitle(measurer, layout);

    const poll: PollRecord = {
      id,
      track: 'system',
      status: 'open',
      title,
      neutralSummary: 'Skjult ingress.',
      sourceUrls: [],
      stortingetIssueId: '103102',
      citizenInitiativeId: null,
      opensAt: null,
      closesAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      expiredAt: null,
      restoredAt: null,
      generationMetadata: {},
    };

    const response = await renderPollShareOgImage(poll, { nei: 12, blank: 3, ja: 45, total: 60 });
    const buffer = Buffer.from(await response.arrayBuffer());
    assert.equal(buffer.readUInt32BE(16), OG_IMAGE_SIZE.width);
    assert.equal(buffer.readUInt32BE(20), OG_IMAGE_SIZE.height);
  }
});
