import assert from 'node:assert/strict';
import { buildTopicAroundRelatedReason, buildTopicAroundSearchQuery } from './topic-around-query';

assert.equal(buildTopicAroundSearchQuery({ title: '  Klima i nord  ' }), 'Klima i nord');
assert.match(
  buildTopicAroundSearchQuery({
    title: 'Energi',
    summary: 'Kort om energipolitikk og nett i nord.',
  }),
  /^Energi\. Kort om energipolitikk/,
);

assert.equal(buildTopicAroundRelatedReason(''), 'Felles tema i Stortinget-dokumenter');
assert.match(buildTopicAroundRelatedReason('Skatt på arv'), /Felles tema: Skatt på arv/);

console.log('lib/search/topic-around-query.test.ts: ok');