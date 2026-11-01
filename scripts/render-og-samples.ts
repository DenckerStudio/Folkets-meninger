/**
 * Renders sample OG PNGs for PR review (run locally: npx tsx scripts/render-og-samples.ts).
 */
import React from 'react';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// tsx executes OG JSX without Next's automatic runtime; ImageResponse needs React in scope.
(globalThis as typeof globalThis & { React: typeof React }).React = React;
import { renderBlogPostOgImage } from '@/lib/blog/og-image';
import { renderPollShareOgImage } from '@/lib/polls/share-og';
import { renderShareOgImage } from '@/lib/seo/share-og';
import type { PollRecord } from '@/lib/polls/types';

const outDir = process.env.OG_SAMPLE_DIR ?? '/opt/cursor/artifacts';

async function savePng(filename: string, response: Response) {
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(join(outDir, filename), buffer);
  console.log('wrote', join(outDir, filename), buffer.length, 'bytes');
}

const samplePoll: PollRecord = {
  id: 'sample-poll',
  track: 'system',
  status: 'open',
  title: 'Bør Norge ha kortere arbeidsuke – hva mener du?',
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

async function main() {
  mkdirSync(outDir, { recursive: true });

  await savePng(
    'og-sample-poll-bar.png',
    await renderPollShareOgImage(samplePoll, { nei: 12, blank: 3, ja: 45, total: 60 }),
  );

  await savePng(
    'og-sample-utforsk-reels.png',
    await renderShareOgImage({
      eyebrow: 'Utforsk',
      title: 'Reels om Stortingssaker',
      description: 'Stem Nei, Blank eller Ja og se hva andre mener.',
      footer: 'folkets-meninger.no · Utforsk',
    }),
  );

  await savePng(
    'og-sample-blog.png',
    await renderBlogPostOgImage(
      'Grunnlovsforslag om uavhengig offentlig påtale',
      'Kort ingress med æøå for typografi.',
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
