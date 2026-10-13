import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CHAT_COMMANDS,
  filterChatCommands,
  findChatCommand,
  isSlashCommandInput,
  parseSlashCommand,
  slashQuery,
} from '@/lib/chat/commands';

test('slash detection only fires for a leading slash on one line', () => {
  assert.equal(isSlashCommandInput('/forklar'), true);
  assert.equal(isSlashCommandInput('  /finn strøm'), true);
  assert.equal(isSlashCommandInput('hei /forklar'), false);
  assert.equal(isSlashCommandInput('/forklar\nmer'), false);
  assert.equal(slashQuery('hei'), null);
  assert.equal(slashQuery('/forklar'), 'forklar');
});

test('parseSlashCommand splits name and argument', () => {
  assert.deepEqual(parseSlashCommand('/finn strømpriser'), {
    name: 'finn',
    argument: 'strømpriser',
  });
  assert.deepEqual(parseSlashCommand('/FORKLAR'), { name: 'forklar', argument: '' });
  assert.deepEqual(parseSlashCommand('/tema ny energi i norge'), {
    name: 'tema',
    argument: 'ny energi i norge',
  });
  assert.equal(parseSlashCommand('vanlig melding'), null);
});

test('filterChatCommands matches name, label and hint', () => {
  assert.equal(filterChatCommands('').length, CHAT_COMMANDS.length);
  assert.deepEqual(
    filterChatCommands('stem').map((c) => c.name),
    ['stemmer'],
  );
  assert.ok(filterChatCommands('argumenter').some((c) => c.name === 'mot'));
  assert.equal(filterChatCommands('zzzz').length, 0);
});

test('commands never include rettskriv or kilder', () => {
  const text = CHAT_COMMANDS.map((c) => `${c.name} ${c.label} ${c.hint}`).join(' ').toLowerCase();
  assert.ok(!text.includes('rettskriv'));
  assert.ok(!text.includes('kilder'));
  assert.equal(findChatCommand('forklar')?.behavior, 'send');
  assert.equal(findChatCommand('ny')?.behavior, 'new-chat');
  assert.equal(findChatCommand('finn')?.behavior, 'compose');
});

test('buildPrompt personalises with the issue title', () => {
  const forklar = findChatCommand('forklar');
  assert.equal(
    forklar?.buildPrompt?.({ issueTitle: 'Strømpriser' }),
    'Forklar «Strømpriser» kort og nøytralt ut fra sakskonteksten.',
  );
  const finn = findChatCommand('finn');
  assert.equal(finn?.buildPrompt?.({ argument: 'skatt' }), 'Finn saker på Stortinget om skatt.');
});
