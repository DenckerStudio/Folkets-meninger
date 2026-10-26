import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildAiSummaryFromDbRow, isMissingForslagColumnError } from './service';

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

const legacyCard = buildAiSummaryFromDbRow({
  narrative: 'Saken gjelder havbruk.',
  topic_cards: [{ title: 'Forslagene (1)', body: '1) Krav om merking.' }],
});
assert.ok(legacyCard?.version === 2);
if (legacyCard?.version === 2) {
  assert.deepEqual(legacyCard.forslag, ['Krav om merking']);
}

assert.equal(
  isMissingForslagColumnError({
    code: '42703',
    message: 'column issue_ai_summaries.forslag does not exist',
  }),
  true,
);
assert.equal(
  isMissingForslagColumnError({
    code: 'PGRST204',
    message: "Could not find the 'forslag' column of 'issue_ai_summaries' in the schema cache",
  }),
  true,
);
assert.equal(
  isMissingForslagColumnError({
    code: '42703',
    message: 'column issue_ai_summaries.narrative does not exist',
  }),
  false,
);
assert.equal(isMissingForslagColumnError({ code: '42501', message: 'permission denied' }), false);
assert.equal(isMissingForslagColumnError(null), false);

const serviceSrc = readFileSync(join(process.cwd(), 'lib/ai-summary/service.ts'), 'utf8');
const withForslagAt = serviceSrc.indexOf('AI_SUMMARY_COLUMNS_WITH_FORSLAG');
const withoutForslagAt = serviceSrc.lastIndexOf('AI_SUMMARY_COLUMNS)');
assert.ok(withForslagAt >= 0 && withoutForslagAt > withForslagAt);
assert.match(serviceSrc, /isMissingForslagColumnError\(error\)/);

console.log('ai-summary service tests passed');
