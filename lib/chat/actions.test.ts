import assert from 'node:assert/strict';
import {
  RETTSSKRIVING_INSTRUCTION,
  isSakContextEmpty,
  isSpellingContext,
  parseSakContextInput,
  runRettsskriving,
  runUpdatedSourceSearch,
  spellingContextLabel,
} from '@/lib/chat/actions';
import { runSakContextRetrieve } from '@/lib/chat/sak-context';
import type { ChatRagClient } from '@/lib/chat/rag';

type QueryResult = { data: unknown; error: null };

function makeRagClient(handlers: {
  maybeSingle: (table: string) => QueryResult;
  list?: (table: string) => QueryResult;
}): ChatRagClient {
  return {
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        ilike: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => handlers.maybeSingle(table),
        then: (onfulfilled: (value: QueryResult) => unknown) =>
          Promise.resolve(handlers.list?.(table) ?? { data: [], error: null }).then(onfulfilled),
      };
      return chain as unknown as ReturnType<ChatRagClient['from']>;
    },
  };
}

assert.equal(isSpellingContext('diskusjon'), true);
assert.equal(isSpellingContext('ugyldig'), false);
assert.equal(spellingContextLabel('horing'), 'Høringsinnspill');

const tooShort = runRettsskriving({ draft: 'kort', context: 'annet' });
assert.equal(tooShort.ok, false);

const spelling = runRettsskriving({
  draft: 'Stortinget bør vurdere forslaget om klima.',
  context: 'diskusjon',
});
assert.equal(spelling.ok, true);
if (!spelling.ok) throw new Error('expected rettskriving ok');
assert.equal(spelling.result.published, false);
assert.equal(spelling.result.mode, 'instruction');
assert.equal(spelling.result.corrected, null);
assert.equal(spelling.result.notes, null);
assert.equal(spelling.result.original, 'Stortinget bør vurdere forslaget om klima.');
assert.equal(spelling.result.instruction, RETTSSKRIVING_INSTRUCTION);
assert.doesNotMatch(spelling.result.instruction, /publisert som innlegg/i);

async function main() {
  const emptyQuery = await runUpdatedSourceSearch('  ab  ');
  assert.equal(emptyQuery.ok, false);
  assert.equal(emptyQuery.unavailable, false);

  const tooShortSak = parseSakContextInput({ query: 'x' });
  assert.equal(tooShortSak.ok, false);
  const tooShortRetrieve = await runSakContextRetrieve({ query: 'x' });
  assert.equal(tooShortRetrieve.ok, false);

  const missing = await runSakContextRetrieve({
    issueId: 'does-not-exist',
    query: '',
    client: makeRagClient({
      maybeSingle: () => ({ data: null, error: null }),
    }),
  });
  assert.equal(missing.ok, true);
  if (!missing.ok) throw new Error('expected missing sak ok');
  assert.equal(missing.result.issue, null);
  assert.equal(missing.result.empty, true);
  assert.equal(missing.result.chunks.length, 0);
  assert.equal(missing.result.summary, null);
  assert.match(missing.result.note ?? '', /ingen matching sak/i);
  assert.equal(isSakContextEmpty(missing.result), true);

  const issueOnly = await runSakContextRetrieve({
    issueId: '200365',
    query: '',
    client: makeRagClient({
      maybeSingle: (table) => {
        if (table === 'stortinget_issues') {
          return {
            data: {
              id: '200365',
              title: 'Førerkort',
              summary: null,
              henvisning: null,
              ferdigbehandlet: false,
            },
            error: null,
          };
        }
        return { data: null, error: null };
      },
    }),
  });
  assert.equal(issueOnly.ok, true);
  if (!issueOnly.ok) throw new Error('expected issue-only ok');
  assert.equal(issueOnly.result.issue?.id, '200365');
  assert.equal(issueOnly.result.empty, true);
  assert.equal(issueOnly.result.summary, null);
  assert.equal(issueOnly.result.chunks.length, 0);
  assert.match(issueOnly.result.note ?? '', /ingen dokumentutdrag/i);

  const filled = await runSakContextRetrieve({
    issueId: '200365',
    query: 'vekt',
    client: makeRagClient({
      maybeSingle: (table) => {
        if (table === 'stortinget_issues') {
          return {
            data: {
              id: '200365',
              title: 'Førerkort',
              summary: 'Kort.',
              henvisning: null,
              ferdigbehandlet: false,
            },
            error: null,
          };
        }
        if (table === 'issue_ai_summaries') {
          return {
            data: { narrative: 'AI-sammendrag fra n8n.', hva: null, hvem: null, kostnad: null },
            error: null,
          };
        }
        return { data: null, error: null };
      },
      list: (table) => {
        if (table === 'document_chunks') {
          return {
            data: [{ document_id: 'd1', chunk_index: 0, content: 'Tekst om vektgrense.' }],
            error: null,
          };
        }
        return { data: [], error: null };
      },
    }),
  });
  assert.equal(filled.ok, true);
  if (!filled.ok) throw new Error('expected filled sak ok');
  assert.equal(filled.result.empty, false);
  assert.equal(filled.result.issue?.id, '200365');
  assert.equal(filled.result.summary, 'AI-sammendrag fra n8n.');
  assert.equal(filled.result.chunks.length, 1);
  assert.equal(filled.result.chunks[0]?.content, 'Tekst om vektgrense.');
  assert.ok(!('embedding' in (filled.result.chunks[0] ?? {})));

  console.log('chat/actions.test.ts: ok');
}

void main();
