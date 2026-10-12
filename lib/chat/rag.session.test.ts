import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ragSrc = readFileSync(new URL('./rag.ts', import.meta.url), 'utf8');
const toolsSrc = readFileSync(new URL('./tools.ts', import.meta.url), 'utf8');
const actionsSrc = readFileSync(new URL('./actions.ts', import.meta.url), 'utf8');
const sakActionSrc = readFileSync(new URL('./sak-context.ts', import.meta.url), 'utf8');
const routeSrc = readFileSync(new URL('../../app/api/chat/route.ts', import.meta.url), 'utf8');
const rettSrc = readFileSync(new URL('../../app/api/chat/rettskriving/route.ts', import.meta.url), 'utf8');
const sourcesSrc = readFileSync(new URL('../../app/api/chat/sources/route.ts', import.meta.url), 'utf8');
const sakSrc = readFileSync(new URL('../../app/api/chat/sak-context/route.ts', import.meta.url), 'utf8');
const panelSrc = readFileSync(
  new URL('../../components/chat/chat-panel-actions.tsx', import.meta.url),
  'utf8',
);

assert.doesNotMatch(ragSrc, /getServiceSupabase/);
assert.match(ragSrc, /getServerSupabase/);
assert.match(ragSrc, /getAnonSupabase/);
assert.match(ragSrc, /issue_id, document_id, chunk_index, content/);
assert.match(ragSrc, /rankChunkForSak/);
assert.doesNotMatch(ragSrc, /hits\.length > 0 \? hits : ranked/);
assert.doesNotMatch(ragSrc, /embedding/);

assert.match(toolsSrc, /client: ragClient/);
assert.match(toolsSrc, /searchIssuesForChat\(query, 8, ragClient\)/);

assert.match(routeSrc, /requireStemmePlus/);
assert.match(routeSrc, /getServerSupabase/);
assert.match(routeSrc, /loadDecryptedByok\(gate\.userId, session\)/);
assert.match(routeSrc, /createChatTools\(issueId, ragClient, vectorize\)/);
assert.doesNotMatch(routeSrc, /getServiceSupabase/);
assert.doesNotMatch(routeSrc, /runtime\s*=\s*['"]edge['"]/);

assert.match(rettSrc, /requireStemmePlus/);
assert.match(rettSrc, /loadDecryptedByok\(gate\.userId, session\)/);
assert.match(rettSrc, /getServerSupabase/);
assert.match(rettSrc, /resolveRettsskrivingResult/);
assert.doesNotMatch(rettSrc, /streamText/);
assert.doesNotMatch(rettSrc, /runtime\s*=\s*['"]edge['"]/);
assert.match(sourcesSrc, /requireStemmePlus/);
assert.match(sourcesSrc, /runUpdatedSourceSearch/);
assert.doesNotMatch(sourcesSrc, /loadDecryptedByok/);
assert.doesNotMatch(sourcesSrc, /streamText/);

assert.match(actionsSrc, /parseSakContextInput/);
assert.doesNotMatch(actionsSrc, /embedding/);
assert.match(sakActionSrc, /retrieveSakContext/);
assert.match(sakActionSrc, /client: input\.client/);
assert.doesNotMatch(sakActionSrc, /embedding/);
assert.doesNotMatch(sakActionSrc, /streamText/);
assert.match(sakSrc, /requireStemmePlus/);
assert.match(sakSrc, /runSakContextRetrieve/);
assert.doesNotMatch(sakSrc, /loadDecryptedByok/);
assert.doesNotMatch(sakSrc, /streamText/);
assert.doesNotMatch(sakSrc, /getServiceSupabase/);
assert.doesNotMatch(sakSrc, /runtime\s*=\s*['"]edge['"]/);
assert.match(panelSrc, /Hent sakskontekst/);
assert.match(panelSrc, /\/api\/chat\/sak-context/);
assert.doesNotMatch(panelSrc, /streamText/);

assert.doesNotMatch(panelSrc, /data-chat-action=["']kilder["']/);
assert.doesNotMatch(panelSrc, /data-chat-action=["']rettskriving["']/);
assert.doesNotMatch(panelSrc, /\/api\/chat\/rettskriving/);
assert.doesNotMatch(panelSrc, /\/api\/chat\/sources/);

const composerAssistsSrc = readFileSync(
  new URL('../../components/opinions/composer-stemme-assists.tsx', import.meta.url),
  'utf8',
);
assert.match(composerAssistsSrc, /Rettskriv/);
assert.match(composerAssistsSrc, /Finn oppdaterte kilder/);
assert.match(composerAssistsSrc, /\/api\/chat\/rettskriving/);
assert.match(composerAssistsSrc, /\/api\/chat\/sources/);

// --- Phase 1: multi-sak + semantic retrieval -------------------------------

const vectorSrc = readFileSync(new URL('./vector-search.ts', import.meta.url), 'utf8');
const instructionsSrc = readFileSync(new URL('./instructions.ts', import.meta.url), 'utf8');

// rag.ts keeps the session/anon cache path and stays free of the embedding column.
assert.match(ragSrc, /from '@\/lib\/chat\/vector-search'/);
assert.match(ragSrc, /retrieveTopicContext/);
assert.match(ragSrc, /mergeChunks/);
assert.match(ragSrc, /searchChunksByVector/);
assert.doesNotMatch(ragSrc, /embedding/);

// Semantic path lives in its own module and only calls the vector RPC.
assert.match(vectorSrc, /match_issue_document_chunks/);
assert.match(vectorSrc, /createOllamaVectorizer/);
assert.doesNotMatch(vectorSrc, /\.select\(/);

assert.match(toolsSrc, /retrieveTopicContext/);
assert.match(toolsSrc, /vectorize/);
assert.match(routeSrc, /createOllamaVectorizer/);
assert.match(instructionsSrc, /retrieveTopicContext/);

// --- Phase 2: Stortinget votering + folkets vilje ---------------------------

const voteSrc = readFileSync(new URL('./vote-alignment.ts', import.meta.url), 'utf8');
const cardSrc = readFileSync(new URL('../../components/chat/chat-tool-result.tsx', import.meta.url), 'utf8');

// Vote totals come from the anon/authenticated RPC, never the service role.
assert.doesNotMatch(voteSrc, /getServiceSupabase/);
assert.match(voteSrc, /getServerSupabase/);
assert.match(voteSrc, /getAnonSupabase/);
assert.match(voteSrc, /get_issue_vote_totals/);
assert.match(voteSrc, /buildAlignmentComparison/);
assert.match(voteSrc, /fetchSakVoteringer/);
assert.doesNotMatch(voteSrc, /embedding/);

assert.match(toolsSrc, /getVoteResults/);
assert.match(toolsSrc, /fetchVoteAlignment/);
assert.match(instructionsSrc, /getVoteResults/);
assert.match(cardSrc, /tool-getVoteResults/);
assert.match(cardSrc, /VoteResultsCard/);


console.log('chat/rag.session.test.ts: ok session-bound overlay RAG');
