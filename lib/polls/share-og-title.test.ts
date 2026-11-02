import assert from 'node:assert/strict';
import React from 'react';
import { test } from 'node:test';
import type { PollRecord } from '@/lib/polls/types';
import {
  OG_IMAGE_SIZE,
  POLL_OG_TITLE_46PX_CHAR_CAP,
  POLL_OG_TITLE_TO_BAR_EXTRA_GAP_PX,
  pollOgTitleCharCap,
  pollOgTitleFontSize,
  renderPollShareOgImage,
} from '@/lib/polls/share-og';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const TITLE_90_CHARS =
  'Skal staten innføre nye avgiftsregler for næringsliv og privatpersoner i hele landet snart';

test('46px title band keeps font size through 90 chars and caps at 90', () => {
  assert.equal(POLL_OG_TITLE_46PX_CHAR_CAP, 90);
  assert.equal(TITLE_90_CHARS.length, 90);
  assert.equal(pollOgTitleFontSize(TITLE_90_CHARS.length), 46);
  assert.equal(pollOgTitleFontSize(91), 40);
  assert.equal(pollOgTitleCharCap(46), 90);
  assert.equal(pollOgTitleCharCap(52), 78);
});

test('title-to-bar spacing constant is within requested 8–16px band', () => {
  assert.ok(POLL_OG_TITLE_TO_BAR_EXTRA_GAP_PX >= 8);
  assert.ok(POLL_OG_TITLE_TO_BAR_EXTRA_GAP_PX <= 16);
});

test('90-char poll title renders 1200×630 OG without error', async () => {
  const poll: PollRecord = {
    id: 'og-title-90',
    track: 'system',
    status: 'open',
    title: TITLE_90_CHARS,
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
  assert.ok(buffer.byteLength > 10_000);
});
