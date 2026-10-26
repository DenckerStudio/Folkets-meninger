import assert from 'node:assert/strict';
import { buildAiSummaryFromDbRow } from './service';

const baseV2Row = {
  narrative: 'Saken gjelder ti tiltak for å forebygge voldtekt.',
  who_affected: '',
  how_affected: '',
  topic_cards: [],
  labels: [],
  hva: 'legacy hva',
  hvem: 'legacy hvem',
  kostnad: 'Ikke omtalt i kilden.',
};

const emptyWho = buildAiSummaryFromDbRow(baseV2Row);
assert.ok(emptyWho);
assert.equal(emptyWho?.version, 2);
if (emptyWho?.version === 2) {
  assert.equal(emptyWho.who_affected, '');
  assert.equal(emptyWho.narrative, baseV2Row.narrative);
  assert.deepEqual(emptyWho.forslag, []);
}

const withForslag = buildAiSummaryFromDbRow({
  ...baseV2Row,
  forslag: ['A', 'B'],
  topic_cards: [{ title: 'Forslagene (2)', body: '1) A; 2) B.' }],
});
assert.ok(withForslag?.version === 2 && withForslag.forslag.length === 2);
assert.equal(withForslag?.version === 2 ? withForslag.topic_cards.length : -1, 0);

const legacy = buildAiSummaryFromDbRow({
  narrative: '   ',
  hva: 'Hva',
  hvem: 'Hvem',
  kostnad: 'Kost',
});
assert.ok(legacy);
assert.equal(legacy?.version, 1);

const noSummary = buildAiSummaryFromDbRow({
  narrative: '',
  hva: '',
  hvem: 'Hvem',
  kostnad: 'Kost',
});
assert.equal(noSummary, null);

console.log('ai-summary service tests passed');
