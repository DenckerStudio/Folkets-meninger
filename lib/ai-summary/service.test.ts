import assert from 'node:assert/strict';
import {
  buildAiSummaryFromDbRow,
  isMissingForslagColumnError,
  readAiSummaryFromDb,
  resolveAiSummaryForApi,
} from './service';

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

assert.equal(isMissingForslagColumnError({ code: '42703' }), true);
assert.equal(isMissingForslagColumnError({ code: 'PGRST202' }), false);
assert.equal(isMissingForslagColumnError({ code: '42501' }), false);
assert.equal(isMissingForslagColumnError(null), false);
assert.equal(
  isMissingForslagColumnError({
    message: 'column issue_ai_summaries.forslag does not exist',
  }),
  false,
);

function issueSummaryMock(
  responses: Array<{ data: unknown; error: { code: string } | null }>,
  stats?: { selectCalls: number },
) {
  let call = 0;
  return {
    from(table: string) {
      assert.equal(table, 'issue_ai_summaries');
      return {
        select(_columns: string) {
          return {
            eq(_column: string, _issueId: string) {
              return {
                async maybeSingle() {
                  if (stats) {
                    stats.selectCalls += 1;
                  }
                  const row = responses[call];
                  call += 1;
                  if (!row) {
                    throw new Error(`Unexpected select call #${call}`);
                  }
                  return row;
                },
              };
            },
          };
        },
      };
    },
  };
}

const savedEnv = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_ROLE_KEY,
};
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';

const v2Row = {
  narrative: 'Kort fortelling.',
  who_affected: 'Innbyggere',
  how_affected: 'Endret hverdag',
  topic_cards: [],
  labels: [],
  hva: 'hva',
  hvem: 'hvem',
  kostnad: 'kost',
};

async function main() {
  const retryStats = { selectCalls: 0 };
  const retryWithoutForslag = await readAiSummaryFromDb(
    '42',
    issueSummaryMock(
      [
        { data: null, error: { code: '42703' } },
        { data: v2Row, error: null },
      ],
      retryStats,
    ),
  );
  assert.equal(retryWithoutForslag.status, 'ok');
  assert.equal(retryWithoutForslag.status === 'ok' ? retryWithoutForslag.summary?.version : -1, 2);
  assert.equal(retryStats.selectCalls, 2);

  const deniedStats = { selectCalls: 0 };
  const readFailed = await readAiSummaryFromDb(
    '42',
    issueSummaryMock([{ data: null, error: { code: '42501' } }], deniedStats),
  );
  assert.equal(readFailed.status, 'read_failed');
  assert.equal(deniedStats.selectCalls, 1);

  let webhookCalls = 0;
  let markCalls = 0;
  const apiReadFailed = await resolveAiSummaryForApi('99', {
    triggerIfMissing: true,
    deps: {
      readFromDb: async () => ({ status: 'read_failed' }),
      markRequested: async () => {
        markCalls += 1;
        return true;
      },
      triggerWebhook: () => {
        webhookCalls += 1;
      },
    },
  });
  assert.equal(apiReadFailed.status, 'read_failed');
  assert.equal(webhookCalls, 0);
  assert.equal(markCalls, 0);

  process.env.NEXT_PUBLIC_SUPABASE_URL = savedEnv.url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = savedEnv.key;

  console.log('ai-summary service tests passed');
}

void main();
