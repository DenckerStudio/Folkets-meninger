import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ragSrc = readFileSync(new URL('./rag.ts', import.meta.url), 'utf8');
const toolsSrc = readFileSync(new URL('./tools.ts', import.meta.url), 'utf8');
const routeSrc = readFileSync(new URL('../../app/api/chat/route.ts', import.meta.url), 'utf8');
const rettSrc = readFileSync(new URL('../../app/api/chat/rettskriving/route.ts', import.meta.url), 'utf8');
const sourcesSrc = readFileSync(new URL('../../app/api/chat/sources/route.ts', import.meta.url), 'utf8');

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

console.log('chat/rag.session.test.ts: ok session-bound overlay RAG');
