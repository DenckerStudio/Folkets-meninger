import assert from 'node:assert/strict';
import React from 'react';
import { test } from 'node:test';
import type { PollRecord } from '@/lib/polls/types';
import {
  OG_IMAGE_SIZE,
  POLL_OG_TITLE_RAW_MAX,
  POLL_OG_TITLE_TO_BAR_EXTRA_GAP_PX,
  clampPollOgText,
  pollOgTitleEndsWithWordBoundaryEllipsis,
  renderPollShareOgImage,
  resolvePollOgTitleDisplay,
  resolvePollOgTitleDisplayWithMeasurer,
} from '@/lib/polls/share-og';
import { loadPollOgTitleMeasurer } from '@/lib/polls/share-og-title-measure';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

/** Longest word-boundary title that fits on 2 lines at 46px / 1060px (Noto 700). */
const TITLE_83_AT_46PX =
  'Skal staten innføre nye avgiftsregler for næringsliv og privatpersoner i hele snart';

const TITLE_84_CHARS =
  'Skal staten innføre nye avgiftsregler for næringsliv og privatpersoner i hele landet';

const TITLE_90_CHARS =
  'Skal staten innføre nye avgiftsregler for næringsliv og privatpersoner i hele landet snart';

const TITLE_WORST_AEOEAA =
  'Bør æøå ÆØÅ innføre nye avgiftsregler for næringsliv og privatpersoner i hele landet snart';

const TITLE_LONG_WORD = `Skal ${'M'.repeat(120)} vurderes av Stortinget?`;

const TITLE_MAX_RAW = 'W'.repeat(POLL_OG_TITLE_RAW_MAX);

async function withMeasurer() {
  return loadPollOgTitleMeasurer();
}

function assertMeasuredTwoLineTitle(
  measurer: Awaited<ReturnType<typeof withMeasurer>>,
  layout: { fontSize: number; title: string },
) {
  assert.ok(
    measurer.fitsTwoLines(layout.title, layout.fontSize),
    `title must fit on 2 lines at ${layout.fontSize}px: ${JSON.stringify(layout.title)} (lines=${measurer.lineCount(layout.title, layout.fontSize)})`,
  );
  assert.ok(
    pollOgTitleEndsWithWordBoundaryEllipsis(layout.title),
    `title ellipsis must be on word boundary: ${JSON.stringify(layout.title)}`,
  );
  if (layout.title.endsWith('…')) {
    assert.match(layout.title, /\S…$/);
  }
}

test('title-to-bar spacing constant is within requested 8–16px band', () => {
  assert.equal(POLL_OG_TITLE_TO_BAR_EXTRA_GAP_PX, 12);
});

test('Noto Sans measurement: ~84 char capacity at 46px, æøå worst case at 40px', async () => {
  const measurer = await withMeasurer();
  assert.equal(TITLE_83_AT_46PX.length, 83);
  assert.ok(measurer.fitsTwoLines(TITLE_83_AT_46PX, 46));
  assert.ok(!measurer.fitsTwoLines(TITLE_84_CHARS, 46));

  let maxLenAt46 = 0;
  for (let n = 1; n <= 90; n += 1) {
    const prefix = TITLE_90_CHARS.slice(0, n);
    if (measurer.fitsTwoLines(prefix, 46)) maxLenAt46 = n;
  }
  assert.ok(maxLenAt46 >= 80 && maxLenAt46 <= 84);

  assert.ok(measurer.fitsTwoLines(TITLE_WORST_AEOEAA, 40));
  assert.ok(!measurer.fitsTwoLines(TITLE_90_CHARS, 46));
});

test('83-, 84-, 90-, max-length, æøå and long-word titles resolve on word boundaries', async () => {
  const measurer = await withMeasurer();

  for (const raw of [
    TITLE_83_AT_46PX,
    TITLE_84_CHARS,
    TITLE_90_CHARS,
    TITLE_MAX_RAW,
    TITLE_WORST_AEOEAA,
    TITLE_LONG_WORD,
  ]) {
    const layout = resolvePollOgTitleDisplayWithMeasurer(raw, measurer);
    assertMeasuredTwoLineTitle(measurer, layout);
  }

  const at83 = resolvePollOgTitleDisplayWithMeasurer(TITLE_83_AT_46PX, measurer);
  assert.equal(at83.fontSize, 46);
  assert.equal(at83.title, TITLE_83_AT_46PX);

  const at84 = resolvePollOgTitleDisplayWithMeasurer(TITLE_84_CHARS, measurer);
  assert.equal(at84.fontSize, 40);

  const at90 = resolvePollOgTitleDisplayWithMeasurer(TITLE_90_CHARS, measurer);
  assert.equal(at90.fontSize, 40);

  const longWord = resolvePollOgTitleDisplayWithMeasurer(TITLE_LONG_WORD, measurer);
  assert.ok(longWord.title.endsWith('…'));
});

test('clampPollOgText respects word boundaries before ellipsis', () => {
  const long = `${'Skal staten '.repeat(20)}avslutning`;
  const clamped = clampPollOgText(long, 96);
  assert.ok(pollOgTitleEndsWithWordBoundaryEllipsis(clamped));
});

test('sample titles render 1200×630 OG PNGs', async () => {
  for (const [id, title] of [
    ['og-title-83', TITLE_83_AT_46PX],
    ['og-title-90', TITLE_90_CHARS],
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
