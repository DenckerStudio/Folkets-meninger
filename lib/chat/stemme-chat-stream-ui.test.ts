import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  STOPPED_BEFORE_TEXT_HINT,
  assistantTextFromParts,
  isActiveToolUIPart,
  messageHasActiveToolPart,
  shouldShowSkriverSvarOnAssistantMessage,
  shouldShowStoppedBeforeTextHint,
} from './stemme-chat-stream-ui';

const activeTool = {
  type: 'tool-retrieveSakContext',
  state: 'input-available',
};
const finishedTool = {
  type: 'tool-retrieveSakContext',
  state: 'output-available',
  output: { ok: true },
};

assert.equal(isActiveToolUIPart(activeTool), true);
assert.equal(isActiveToolUIPart(finishedTool), false);
assert.equal(messageHasActiveToolPart([activeTool]), true);
assert.equal(messageHasActiveToolPart([finishedTool, { type: 'text', text: '' }]), false);

assert.equal(
  shouldShowSkriverSvarOnAssistantMessage({
    busy: true,
    isLastAssistantMessage: true,
    parts: [activeTool],
  }),
  false,
);

assert.equal(
  shouldShowSkriverSvarOnAssistantMessage({
    busy: true,
    isLastAssistantMessage: true,
    parts: [finishedTool],
  }),
  true,
);

assert.equal(
  shouldShowSkriverSvarOnAssistantMessage({
    busy: true,
    isLastAssistantMessage: true,
    parts: [{ type: 'text', text: 'Hei' }],
  }),
  false,
);

assert.equal(
  shouldShowSkriverSvarOnAssistantMessage({
    busy: false,
    isLastAssistantMessage: true,
    parts: [],
  }),
  false,
);

assert.equal(assistantTextFromParts([{ type: 'text', text: '  ' }]), '');

assert.equal(
  shouldShowStoppedBeforeTextHint({
    busy: false,
    messageRole: 'assistant',
    messageId: 'a1',
    stoppedEmptyHintMessageId: 'a1',
    parts: [finishedTool],
  }),
  true,
);

assert.equal(
  shouldShowStoppedBeforeTextHint({
    busy: false,
    messageRole: 'assistant',
    messageId: 'a1',
    stoppedEmptyHintMessageId: 'a1',
    parts: [{ type: 'text', text: 'Ferdig' }],
  }),
  false,
);

assert.equal(
  shouldShowStoppedBeforeTextHint({
    busy: true,
    messageRole: 'assistant',
    messageId: 'a1',
    stoppedEmptyHintMessageId: 'a1',
    parts: [],
  }),
  false,
);

const chatSrc = readFileSync(
  new URL('../../components/chat/stemme-chat.tsx', import.meta.url),
  'utf8',
);
assert.match(chatSrc, /shouldShowSkriverSvarOnAssistantMessage/);
assert.match(chatSrc, /shouldShowStoppedBeforeTextHint/);
assert.match(chatSrc, /STOPPED_BEFORE_TEXT_HINT/);
assert.equal(STOPPED_BEFORE_TEXT_HINT, 'Svaret ble stoppet før det kom noe tekst.');

console.log('lib/chat/stemme-chat-stream-ui.test.ts ok');
