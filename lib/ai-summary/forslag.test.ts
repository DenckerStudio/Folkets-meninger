import assert from 'node:assert/strict';
import {
  isForslageneTopicCard,
  parseForslagItemsFromCardBody,
  parseForslagJsonb,
  resolveForslagForSummary,
} from './forslag';

const ten = Array.from({ length: 10 }, (_, i) => `Forslag ${i + 1} til regjeringen.`);

assert.equal(parseForslagJsonb(ten)?.length, 10);
assert.deepEqual(parseForslagJsonb([]), []);
assert.equal(parseForslagJsonb(null), null);

const cardBody = ten.map((t, i) => `${i + 1}) ${t}`).join('; ') + '.';
const parsed = parseForslagItemsFromCardBody(cardBody);
assert.equal(parsed.length, 10);
assert.equal(parsed[0], ten[0]);

assert.ok(isForslageneTopicCard('Forslagene (10)'));

const fromColumn = resolveForslagForSummary(ten, [
  { title: 'Forslagene (10)', body: cardBody },
  { title: 'Annet', body: 'tekst' },
]);
assert.equal(fromColumn.forslag.length, 10);
assert.equal(fromColumn.topic_cards.length, 1);
assert.equal(fromColumn.topic_cards[0]?.title, 'Annet');

const emptyColumn = resolveForslagForSummary([], [
  { title: 'Forslagene (10)', body: cardBody },
]);
assert.deepEqual(emptyColumn.forslag, []);
assert.equal(emptyColumn.topic_cards.length, 0);

const legacy = resolveForslagForSummary(null, [{ title: 'Forslagene (2)', body: '1) A; 2) B.' }]);
assert.deepEqual(legacy.forslag, ['A', 'B']);

console.log('ai-summary forslag tests passed');
