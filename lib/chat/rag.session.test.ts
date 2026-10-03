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
assert.match(ragSrc, /document_id, chunk_index, content/);
assert.doesNotMatch(ragSrc, /embedding/);

assert.match(toolsSrc, /client: ragClient/);
assert.match(toolsSrc, /searchIssuesForChat\(query, 8, ragClient\)/);

assert.match(routeSrc, /requireStemmePlus/);
assert.match(routeSrc, /getServerSupabase/);
assert.match(routeSrc, /loadDecryptedByok\(gate\.userId, session\)/);
assert.match(routeSrc, /createChatTools\(issueId, ragClient\)/);
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

console.log('chat/rag.session.test.ts: ok session-bound overlay RAG');
