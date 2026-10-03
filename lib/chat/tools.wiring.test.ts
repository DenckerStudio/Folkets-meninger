import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createChatTools } from './tools';

/**
 * Fake-provider-free chat turn: invoke the three production tools directly.
 * No mock chatbot UI. retrieveSakContext needs Folkets service role to
 * return chunks; the other two tools run without it.
 */
async function main() {
  const tools = createChatTools('200365');

  const retrieve = await tools.retrieveSakContext.execute(
    { issueId: '200365', query: 'vektgrense førerkort' },
    { toolCallId: 'retrieve-1', messages: [], abortSignal: undefined as never },
  );

  const spelling = await tools.helpRettsskriving.execute(
    {
      draft: 'Jeg meiner stortinget burde heve vektgrensen for førerkort klasse B.',
      context: 'motforslag',
    },
    { toolCallId: 'rett-1', messages: [], abortSignal: undefined as never },
  );

  const sources = await tools.searchUpdatedSources.execute(
    { query: 'Dokument 8:314 S førerkort vektgrense' },
    { toolCallId: 'searx-1', messages: [], abortSignal: undefined as never },
  );

  assert.equal(spelling.context, 'motforslag');
  assert.match(spelling.instruction, /rettskriving|stavemåte|grammatikk/i);
  assert.equal(typeof retrieve.note === 'string' || Array.isArray(retrieve.chunks), true);
  assert.equal(typeof sources.unavailable, 'boolean');

  const payload = {
    issueId: '200365',
    retrieve: {
      issueId: retrieve.issue?.id ?? null,
      chunkCount: retrieve.chunks.length,
      hasSummary: Boolean(retrieve.summary),
      note: retrieve.note,
    },
    rettskriving: {
      context: spelling.context,
      instructionOnly: !('corrected' in spelling),
    },
    searxng: {
      unavailable: sources.unavailable,
      resultCount: Array.isArray(sources.results) ? sources.results.length : 0,
      titles: Array.isArray(sources.results)
        ? sources.results.slice(0, 3).map((hit: { title?: string }) => hit.title)
        : [],
    },
  };

  writeFileSync('/opt/cursor/artifacts/chat-tools-wiring.json', JSON.stringify(payload, null, 2));
  console.log('chat/tools.wiring.test.ts: ok', JSON.stringify(payload.retrieve), 'searx', payload.searxng.resultCount);
}

void main();
