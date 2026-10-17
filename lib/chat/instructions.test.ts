import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCitationRegistry, uniqueSources } from './citations';
import { CHAT_PROMPT_VERSION, buildChatInstructions } from './instructions';
import { FOCUSED_CHAT_TOOL_NAMES, createChatTools, selectFocusedChatTools } from './tools';

const now = new Date('2026-10-17T10:00:00Z');
const prompt = buildChatInstructions(null, now);

assert.equal(CHAT_PROMPT_VERSION, 'stemme-chat-v2');
assert.match(prompt, /Dagens dato er lørdag 17\. oktober 2026/);
assert.match(prompt, /Stortingsperioden er 2025–2029/);
assert.match(prompt, /politisk nøytral/);
assert.match(prompt, /Gi aldri stemmeråd/);
assert.match(prompt, /\[1\] eller \[2\]\[3\]/);
assert.match(prompt, /Dette fant jeg ikke i kildene/);
assert.match(prompt, /Kilder:/);
assert.match(prompt, /bokmål/);
// No «AI» self-label and no tool catalogue in the prompt.
assert.doesNotMatch(prompt, /\bAI\b/);
assert.doesNotMatch(prompt, /- retrieveTopicContext:/);
assert.ok(prompt.length < 4500, `prompt too long: ${prompt.length}`);

assert.match(buildChatInstructions('200365', now), /åpnet sak 200365/);

// Focused tool profile keeps the essentials, including the personal tools.
const all = createChatTools({ preferredIssueId: null });
const focused = selectFocusedChatTools(all);
assert.deepEqual(Object.keys(focused).sort(), [...FOCUSED_CHAT_TOOL_NAMES].sort());
for (const name of ['listMyNotifications', 'getInnspillStatus', 'getImpact', 'getMyActivity'] as const) {
  assert.ok(name in focused, `${name} must stay in the focused set`);
}
// Politician and poll pages open with suggestions only these tools can answer.
for (const name of ['getPolitician', 'getPollResults'] as const) {
  assert.ok(name in focused, `${name} must stay in the focused set`);
}
for (const name of ['helpRettsskriving', 'listSakDocuments', 'getFolketsMeninger', 'getPublicProfile']) {
  assert.ok(!(name in focused), `${name} should not be sent to the model`);
}
assert.ok(Object.keys(focused).length < Object.keys(all).length);

const routeSrc = readFileSync(new URL('../../app/api/chat/route.ts', import.meta.url), 'utf8');
assert.match(routeSrc, /selectFocusedChatTools\(/);

// Citation registry: stable, de-duplicated numbering per request.
const registry = createCitationRegistry();
const sak = registry.cite({ kind: 'sak', title: 'Vektgrense', issueId: '200365' });
const docA = registry.cite({ kind: 'dokument', title: 'Dok 8', issueId: '200365', documentId: 'D1' });
const docAgain = registry.cite({ kind: 'dokument', title: 'Dok 8 (utdrag 2)', issueId: '200365', documentId: 'D1' });
const web = registry.cite({ kind: 'nett', title: '', url: 'https://example.no/a' });
assert.equal(sak.n, 1);
assert.equal(docA.n, 2);
assert.equal(docAgain.n, 2);
assert.equal(web.n, 3);
assert.equal(web.title, 'Uten tittel');
assert.deepEqual(registry.list().map((s) => s.n), [1, 2, 3]);
assert.deepEqual(uniqueSources([web, sak, docA, docAgain]).map((s) => s.n), [1, 2, 3]);

console.log('lib/chat/instructions.test.ts ok');
