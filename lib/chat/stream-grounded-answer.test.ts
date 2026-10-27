import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { TextStreamPart } from 'ai';
import { createCitationRegistry } from '@/lib/chat/citations';
import { createChatRagExcerptCollector } from '@/lib/chat/rag-excerpt-collector';
import {
  applyStreamedGroundedPostProcess,
  createGroundedAnswerStreamTransform,
} from '@/lib/chat/stream-grounded-answer';
import { formatVoteringRagSummary } from '@/lib/stortinget-votering-rag';

const votering28432 = formatVoteringRagSummary('28432', 'Kontroll av drivstoffkjeder', {
  SV: 'for',
  H: 'mot',
});

const registry = createCitationRegistry();
registry.cite({ kind: 'dokument', title: 'Prop', issueId: '1', documentId: 'd1' });
registry.cite({ kind: 'dokument', title: 'Votering', issueId: '1', documentId: 'v1' });
const collector = createChatRagExcerptCollector(registry);
collector.recordDocumentExcerpt(1, 'Prop om drivstoff.');
collector.recordDocumentExcerpt(2, votering28432);

const excerpts = collector.excerptsAlignedWithCitations();
assert.equal(excerpts.length, 2);
assert.match(excerpts[1]!, /Votering 28432/);

const contradictory =
  'I votering 28432 stemte SV for forslaget. I samme votering stemte SV mot forslaget.';
const guarded = applyStreamedGroundedPostProcess(contradictory, excerpts);
assert.match(guarded, /stemte SV for/i);
assert.ok(!/stemte SV mot/i.test(guarded));

const benign = 'SV stemte for i votering 28432, i tråd med kildene [2].';
const benignOut = applyStreamedGroundedPostProcess(benign, excerpts);
assert.equal(benignOut, benign);

async function collectAssistantText(
  parts: TextStreamPart<Record<string, never>>[],
  getExcerpts: () => readonly string[],
): Promise<string> {
  const transform = createGroundedAnswerStreamTransform(getExcerpts)({
    tools: {},
    stopStream: () => {},
  });
  const input = new ReadableStream<TextStreamPart<Record<string, never>>>({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  });
  const output = input.pipeThrough(transform);
  const reader = output.getReader();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value.type === 'text-delta') text += value.text;
  }
  return text;
}

const streamParts = (body: string): TextStreamPart<Record<string, never>>[] => [
  { type: 'text-start', id: 't0' },
  { type: 'text-delta', id: 't0', text: body },
  { type: 'text-end', id: 't0' },
];

void (async () => {
  const streamedGuarded = await collectAssistantText(streamParts(contradictory), () => excerpts);
  assert.match(streamedGuarded, /stemte SV for/i);
  assert.ok(!/stemte SV mot/i.test(streamedGuarded));

  const streamedBenign = await collectAssistantText(streamParts(benign), () => excerpts);
  assert.equal(streamedBenign, benign);

  const routeSrc = readFileSync(new URL('../../app/api/chat/route.ts', import.meta.url), 'utf8');
  assert.match(routeSrc, /createGroundedAnswerStreamTransform/);
  assert.match(routeSrc, /createChatRagExcerptCollector/);
  assert.match(routeSrc, /experimental_transform:/);

  console.log('lib/chat/stream-grounded-answer.test.ts ok');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
