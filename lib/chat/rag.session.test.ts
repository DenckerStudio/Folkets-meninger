import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ragSrc = readFileSync(new URL('./rag.ts', import.meta.url), 'utf8');
const toolsSrc = readFileSync(new URL('./tools.ts', import.meta.url), 'utf8');
const routeSrc = readFileSync(new URL('../../app/api/chat/route.ts', import.meta.url), 'utf8');

assert.doesNotMatch(ragSrc, /getServiceSupabase/);
assert.match(ragSrc, /getServerSupabase/);
assert.match(ragSrc, /getAnonSupabase/);
assert.match(ragSrc, /document_id, chunk_index, content/);
assert.doesNotMatch(ragSrc, /embedding/);

assert.match(toolsSrc, /client: ragClient/);
assert.match(toolsSrc, /searchIssuesForChat\(query, 8, ragClient\)/);

assert.match(routeSrc, /requireStemmePlus/);
assert.match(routeSrc, /getServerSupabase/);
assert.match(routeSrc, /createChatTools\(issueId, ragClient\)/);
assert.doesNotMatch(routeSrc, /runtime\s*=\s*['"]edge['"]/);

console.log('chat/rag.session.test.ts: ok session-bound overlay RAG');
