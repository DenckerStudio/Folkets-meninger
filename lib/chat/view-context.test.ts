import assert from 'node:assert/strict';
import test from 'node:test';
import { chatViewKey, resolveChatView } from '@/lib/chat/view-context';

test('resolveChatView detects sak, mening, politiker, reel and horing ids', () => {
  assert.deepEqual(resolveChatView('/dashboard/sak/200365'), { kind: 'sak', id: '200365' });
  assert.deepEqual(resolveChatView('/dashboard/folkets-meninger/abc-123'), {
    kind: 'mening',
    id: 'abc-123',
  });
  assert.deepEqual(resolveChatView('/dashboard/politikere/42'), { kind: 'politiker', id: '42' });
  assert.deepEqual(resolveChatView('/dashboard/avstemninger/poll-1'), {
    kind: 'reel',
    id: 'poll-1',
  });
  assert.deepEqual(resolveChatView('/dashboard/horinger/h-9'), { kind: 'horing', id: 'h-9' });
});

test('resolveChatView handles list routes and query strings', () => {
  assert.deepEqual(resolveChatView('/dashboard/utforsk'), { kind: 'utforsk', id: null });
  assert.deepEqual(resolveChatView('/dashboard/folkets-meninger'), {
    kind: 'folkets-meninger',
    id: null,
  });
  assert.deepEqual(resolveChatView('/dashboard/horinger'), { kind: 'horinger', id: null });
  assert.deepEqual(resolveChatView('/dashboard/sak/200365?chat=1'), {
    kind: 'sak',
    id: '200365',
  });
  assert.deepEqual(resolveChatView('/dashboard/ukjent-side'), { kind: 'general', id: null });
  assert.deepEqual(resolveChatView(null), { kind: 'general', id: null });
  assert.deepEqual(resolveChatView(''), { kind: 'general', id: null });
});

test('resolveChatView decodes ids and ignores nested sak paths', () => {
  assert.deepEqual(resolveChatView('/dashboard/sak/200365/dokumenter'), {
    kind: 'general',
    id: null,
  });
  assert.deepEqual(resolveChatView('/dashboard/sak/abc%20def'), { kind: 'sak', id: 'abc def' });
});

test('chatViewKey is stable and distinguishes ids', () => {
  assert.equal(chatViewKey({ kind: 'sak', id: '1' }), 'sak:1');
  assert.equal(chatViewKey({ kind: 'utforsk', id: null }), 'utforsk');
  assert.equal(chatViewKey(null), 'general');
});
