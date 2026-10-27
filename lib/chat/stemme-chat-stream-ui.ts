/**
 * Pure UI rules for streamed Stemme+ chat (typing indicator, stop-without-text hint).
 */

export const STOPPED_BEFORE_TEXT_HINT =
  'Svaret ble stoppet før det kom noe tekst.';

type MessagePart = { type: string; state?: string; output?: unknown; text?: string };

export function assistantTextFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return '';
  return parts
    .filter((part): part is MessagePart => typeof part === 'object' && part !== null && 'type' in part)
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text ?? '')
    .join('\n')
    .trim();
}

/** Tool UI part still running (spinner row), not finished with output. */
export function isActiveToolUIPart(part: unknown): boolean {
  if (typeof part !== 'object' || part === null || !('type' in part)) return false;
  const typed = part as MessagePart;
  if (!typed.type.startsWith('tool-')) return false;
  const done = typed.state === 'output-available' && typed.output !== undefined;
  return !done;
}

export function messageHasActiveToolPart(parts: unknown): boolean {
  if (!Array.isArray(parts)) return false;
  return parts.some(isActiveToolUIPart);
}

/** «Skriver svar…» on the in-flight assistant turn (not while a tool row is active). */
export function shouldShowSkriverSvarOnAssistantMessage(options: {
  busy: boolean;
  isLastAssistantMessage: boolean;
  parts: unknown;
}): boolean {
  if (!options.busy || !options.isLastAssistantMessage) return false;
  if (assistantTextFromParts(options.parts)) return false;
  if (messageHasActiveToolPart(options.parts)) return false;
  return true;
}

export function shouldShowStoppedBeforeTextHint(options: {
  busy: boolean;
  messageRole: string;
  messageId: string;
  stoppedEmptyHintMessageId: string | null;
  parts: unknown;
}): boolean {
  if (options.busy || options.messageRole !== 'assistant') return false;
  if (options.stoppedEmptyHintMessageId !== options.messageId) return false;
  return assistantTextFromParts(options.parts) === '';
}
