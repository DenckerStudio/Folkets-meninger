import assert from 'node:assert/strict';
import {
  formatOppfangetSourcePublisher,
  sortOppfangetSources,
} from '@/lib/admin/oppfanget/source-display';
import type { OppfangetSourceRow } from '@/lib/admin/oppfanget/types';

const reddit: OppfangetSourceRow = {
  id: '1',
  url: 'https://www.adressa.no/art',
  publisher: 'adressa.no',
  signalOnly: false,
  title: 'Tittel',
  sourceType: 'reddit',
};

assert.match(formatOppfangetSourcePublisher(reddit), /Reddit/);

const sorted = sortOppfangetSources([
  { ...reddit, id: 'r', sourceType: 'reddit' },
  {
    id: 'n',
    url: 'https://nrk.no/x',
    publisher: 'nrk.no',
    signalOnly: false,
    title: null,
    sourceType: 'news_rss',
  },
]);
assert.equal(sorted[0]?.sourceType, 'news_rss');

console.log('admin/oppfanget/source-display.test.ts: ok');
