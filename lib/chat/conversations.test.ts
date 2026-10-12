import assert from 'node:assert/strict';
import {
  extractText,
  titleFromMessages,
  toStoredMessages,
  MAX_CONVERSATIONS,
  type StoredConversation,
} from './conversations';

async function main() {
  const messages = [
    { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'Hva koster innvandringsloven?' }] },
    {
      id: 'a1',
      role: 'assistant',
      parts: [
        { type: 'step-start' },
        { type: 'text', text: 'Svaret er kort.' },
      ],
    },
  ];

  assert.equal(extractText(messages[0].parts), 'Hva koster innvandringsloven?');
  assert.equal(extractText(messages[1].parts), 'Svaret er kort.');
  assert.equal(extractText(null), '');
  assert.equal(extractText([{ type: 'tool-getVoteResults' }]), '');

  assert.equal(titleFromMessages(messages), 'Hva koster innvandringsloven?');

  const long = 'x'.repeat(80);
  const truncated = titleFromMessages([
    { id: 'u', role: 'user', parts: [{ type: 'text', text: long }] },
  ]);
  assert.equal(truncated.length, 49);
  assert.ok(truncated.endsWith('…'));

  // No user message -> honest fallback title.
  assert.equal(titleFromMessages([]), 'Ny samtale');

  const stored = toStoredMessages(messages);
  assert.equal(stored.length, 2);
  assert.equal(stored[0].id, 'u1');
  assert.equal(stored[1].role, 'assistant');

  assert.ok(MAX_CONVERSATIONS >= 1);

  console.log('chat/conversations.test.ts: ok');
}

void main();

export type { StoredConversation };
