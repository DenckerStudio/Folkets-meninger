import assert from 'node:assert/strict';
import { filterPublicTopicBriefSources } from '@/lib/sources/public-topic-sources';

const filtered = filterPublicTopicBriefSources({
  items: [
    {
      id: 'r1',
      title: 'Skjules',
      url: 'https://www.reddit.com/r/norge/comments/x',
      grade: 'D',
    },
    {
      id: 'a1',
      title: 'NRK',
      url: 'https://www.nrk.no/sak',
      publisher: 'nrk.no',
      grade: 'A',
    },
    {
      id: 'a2',
      title: 'Stortinget',
      url: 'https://www.stortinget.no/no/Saker/',
      publisher: 'stortinget.no',
      grade: 'A',
    },
  ],
  note: 'ok',
});

assert.equal(filtered.length, 2);
assert.equal(filtered[0]?.url, 'https://www.nrk.no/sak');

console.log('lib/sources/public-topic-sources.test.ts: ok');