import assert from 'node:assert/strict';
import { listReelPollSourceLinks } from '@/lib/polls/reel-source-links';

const poll = {
  id: 'p1',
  track: 'system' as const,
  status: 'open' as const,
  title: 'Test',
  neutralSummary: 'Sammendrag',
  sourceUrls: [
    { label: 'Dokument', url: 'https://example.com/doc' },
    { url: 'https://example.com/dup' },
  ],
  stortingetIssueId: '12345',
  citizenInitiativeId: null,
  opensAt: null,
  closesAt: null,
  createdAt: '',
  updatedAt: '',
  generationMetadata: {},
};

const links = listReelPollSourceLinks(poll);
assert.equal(links.length, 3);
assert.equal(links[0].href, '/dashboard/sak/12345');
assert.equal(links[0].external, false);
assert.equal(links[1].label, 'Dokument');
assert.equal(links[1].external, true);

const deduped = listReelPollSourceLinks({
  ...poll,
  sourceUrls: [{ url: '/dashboard/sak/12345', label: 'Dup' }],
});
assert.equal(deduped.length, 1);

console.log('reel-source-links tests passed');
