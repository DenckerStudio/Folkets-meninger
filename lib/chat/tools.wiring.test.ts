import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createChatTools } from './tools';

function loadFolketsPublicEnv() {
  const text = readFileSync('/workspace/.env.test', 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    const key = line.slice(0, i);
    const value = line.slice(i + 1);
    if (key.startsWith('NEXT_PUBLIC_SUPABASE')) {
      process.env[key] = value;
    }
  }
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
}

loadFolketsPublicEnv();

/**
 * Fake-provider-free overlay chat turn: invoke the production tools directly.
 * No mock chatbot UI. retrieveSakContext uses the public session/anon sak
 * cache, not the Cloud Agent service role.
 */
async function main() {
  assert.equal(process.env.SUPABASE_SERVICE_ROLE_KEY, undefined);
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

  const listed = await tools.listMatchingSaker.execute(
    { query: '200365' },
    { toolCallId: 'list-1', messages: [], abortSignal: undefined as never },
  );

  assert.equal(spelling.context, 'motforslag');
  assert.match(spelling.instruction, /rettskriving|stavemåte|grammatikk/i);
  assert.equal(retrieve.issue?.id, '200365');
  assert.ok(retrieve.chunks.length > 0 || retrieve.summary);
  assert.ok(listed.issues.some((issue) => issue.id === '200365'));
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
      instructionOnly: spelling.mode === 'instruction' && spelling.corrected == null,
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
