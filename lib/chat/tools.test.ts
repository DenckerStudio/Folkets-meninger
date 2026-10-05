import assert from 'node:assert/strict';
import { createChatTools } from './tools';

async function main() {
  const tools = createChatTools('1234');
  const spelling = await tools.helpRettsskriving.execute(
    {
      draft: 'Stortinget bør vurdere forslaget om klima.',
      context: 'diskusjon',
    },
    { toolCallId: 't1', messages: [], abortSignal: undefined as never },
  );

  assert.equal(spelling.original, 'Stortinget bør vurdere forslaget om klima.');
  assert.equal(spelling.context, 'diskusjon');
  assert.equal(spelling.mode, 'instruction');
  assert.equal(spelling.corrected, null);
  assert.match(spelling.instruction, /rettskriving|stavemåte|grammatikk/i);
  assert.doesNotMatch(spelling.instruction, /generer et ferdig innlegg som om det var publisert/i);
  console.log('chat/tools.test.ts: ok');
}

void main();
