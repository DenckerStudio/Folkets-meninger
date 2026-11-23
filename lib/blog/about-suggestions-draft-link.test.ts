import assert from 'node:assert/strict';
import {
  aboutSuggestionSourceEvent,
  reconcileOrphanAboutSuggestions,
  resolveAboutSuggestionUsedHasDraft,
} from '@/lib/blog/about-suggestions-draft-link';
import type { AboutSuggestionStored } from '@/lib/blog/about-suggestions-store';

const row: AboutSuggestionStored = {
  key: 'dekning:faq:representativitet',
  title: 'Er tallene representative?',
  angle: 'Forklar datagrunnlaget',
  reason: 'Ofte stilt spørsmål.',
  source: 'dekning',
  related: null,
  provenance: {},
  evergreen: false,
  status: 'used',
  snoozeUntil: null,
  draftRequestId: '3f2b8c1a-9d4e-4f6a-8b7c-1e2d3c4b5a69',
  sourceEvent: null,
};

void (async () => {
  assert.equal(
    aboutSuggestionSourceEvent(row),
    'about:3f2b8c1a-9d4e-4f6a-8b7c-1e2d3c4b5a69',
  );
  assert.equal(await resolveAboutSuggestionUsedHasDraft({ ...row, sourceEvent: null, draftRequestId: null }, async () => ({ found: false })), false);

  assert.equal(
    await resolveAboutSuggestionUsedHasDraft(row, async () => ({
      found: true,
      id: 'post-1',
      slug: 'om-oss',
      adminUrl: 'https://cms.example.test/post-1',
      cmsStatus: 'draft',
    })),
    true,
  );

  const reopened: string[] = [];
  const reconciled = await reconcileOrphanAboutSuggestions({
    rows: [row],
    lookupPost: async () => ({ found: false }),
    reopen: async (key) => {
      reopened.push(key);
      return { ok: true };
    },
  });
  assert.deepEqual(reopened, [row.key]);
  assert.equal(reconciled[0]?.status, 'open');
  assert.equal(reconciled[0]?.draftRequestId, null);

  console.log('lib/blog/about-suggestions-draft-link.test.ts ok');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});