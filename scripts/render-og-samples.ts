/**
 * Renders sample OG PNGs for PR review (run locally: npx tsx scripts/render-og-samples.ts).
 */
import React from 'react';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PollRecord } from '@/lib/polls/types';

(globalThis as typeof globalThis & { React: typeof React }).React = React;
import { renderBlogPostOgImage } from '@/lib/blog/og-image';
import { renderPollShareOgImage } from '@/lib/polls/share-og';
import { renderShareOgImage } from '@/lib/seo/share-og';

const outDir = process.env.OG_SAMPLE_DIR ?? '/workspace/docs/og-samples';

function pngDimensions(buffer: Buffer): { width: number; height: number } {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function savePng(filename: string, response: Response) {
  const buffer = Buffer.from(await response.arrayBuffer());
  const { width, height } = pngDimensions(buffer);
  if (width !== 1200 || height !== 630) {
    throw new Error(`${filename}: expected 1200×630, got ${width}×${height}`);
  }
  writeFileSync(join(outDir, filename), buffer);
  console.log('wrote', join(outDir, filename), buffer.length, 'bytes');
}

const basePoll: PollRecord = {
  id: 'sample-poll',
  track: 'system',
  status: 'open',
  title: 'Bør Norge ha kortere arbeidsuke – æøå ÆØÅ · tall 0123?',
  neutralSummary: 'Eksempelspørsmål med norske bokstaver: æøå.',
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

const longTwoLineTitle =
  'Skal staten gå videre med omfattende endringer i skatte- og avgiftsregelverket for næringsliv og privatpersoner i hele landet, også i distriktene, på kort sikt?';

/** Exactly 90 tegn — tittelstørrelse 46px, to linjer uten å flyte over kortet. */
const title90Chars =
  'Skal staten innføre nye avgiftsregler for næringsliv og privatpersoner i hele landet snart';

async function main() {
  mkdirSync(outDir, { recursive: true });

  await savePng(
    'og-sample-poll-bar.png',
    await renderPollShareOgImage(basePoll, { nei: 12, blank: 3, ja: 45, total: 60 }),
  );

  await savePng(
    'og-sample-poll-few-votes.png',
    await renderPollShareOgImage(basePoll, { nei: 2, blank: 1, ja: 3, total: 6 }),
  );

  await savePng(
    'og-sample-poll-zero-votes.png',
    await renderPollShareOgImage(basePoll, { nei: 0, blank: 0, ja: 0, total: 0 }),
  );

  await savePng(
    'og-sample-poll-glyphs.png',
    await renderPollShareOgImage(
      {
        ...basePoll,
        title: 'Ærlig meningsmåling: æøå ÆØÅ – Nei · Blank · Ja 0123',
      },
      { nei: 12, blank: 3, ja: 45, total: 60 },
    ),
  );

  await savePng(
    'og-sample-poll-long-title.png',
    await renderPollShareOgImage(
      {
        ...basePoll,
        title: longTwoLineTitle,
        neutralSummary: 'Denne ingressen skal ikke vises når tittelen er lang.',
      },
      { nei: 12, blank: 3, ja: 45, total: 60 },
    ),
  );

  await savePng(
    'og-sample-poll-long-title-few-votes.png',
    await renderPollShareOgImage(
      { ...basePoll, title: longTwoLineTitle, neutralSummary: 'Skjult ingress.' },
      { nei: 2, blank: 1, ja: 3, total: 6 },
    ),
  );

  await savePng(
    'og-sample-poll-title-90-chars.png',
    await renderPollShareOgImage(
      { ...basePoll, title: title90Chars, neutralSummary: 'Skjult ingress.' },
      { nei: 12, blank: 3, ja: 45, total: 60 },
    ),
  );

  await savePng(
    'og-sample-poll-short-title-summary.png',
    await renderPollShareOgImage(
      {
        ...basePoll,
        title: 'Kortere arbeidsuke?',
        neutralSummary:
          'Et lengre sammendrag som forklarer bakgrunnen for spørsmålet og hvorfor det er aktuelt nå, med æøå og typografi · …',
      },
      { nei: 12, blank: 3, ja: 45, total: 60 },
    ),
  );

  await savePng(
    'og-sample-blog.png',
    await renderBlogPostOgImage(
      'Grunnlovsforslag om uavhengig offentlig påtale',
      'Kort ingress med æøå for typografi.',
    ),
  );

  await savePng(
    'og-sample-sak.png',
    await renderShareOgImage({
      eyebrow: 'Stortingssak',
      title: 'Endringer i skatte- og avgiftsregelverket (2025–2026)',
      description: 'Komité: Finans- og næringskomiteen',
      pills: [
        { label: 'Proposisjon', tone: 'neutral' },
        { label: 'Under behandling', tone: 'positive' },
      ],
      footer: 'folkets-meninger.no · Hva mener du om saken?',
    }),
  );

  console.log('all PNGs verified 1200×630');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
