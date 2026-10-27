import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { TextStreamPart, ToolSet } from 'ai';
import { createCitationRegistry } from '@/lib/chat/citations';
import { createChatRagExcerptCollector } from '@/lib/chat/rag-excerpt-collector';
import {
  applyStreamedGroundedPostProcess,
  createGroundedAnswerStreamTransform,
  shouldBufferStreamGroundedPostProcess,
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
assert.equal(shouldBufferStreamGroundedPostProcess(excerpts), true);
assert.equal(shouldBufferStreamGroundedPostProcess([]), false);
assert.equal(shouldBufferStreamGroundedPostProcess(['', '  ']), false);

const contradictory =
  'I votering 28432 stemte SV for forslaget. I samme votering stemte SV mot forslaget.';
const guarded = applyStreamedGroundedPostProcess(contradictory, excerpts);
assert.match(guarded, /stemte SV for/i);
assert.ok(!/stemte SV mot/i.test(guarded));

const benign = 'SV stemte for i votering 28432, i tråd med kildene [2].';
const benignOut = applyStreamedGroundedPostProcess(benign, excerpts);
assert.equal(benignOut, benign);

type Part = TextStreamPart<ToolSet>;

async function pipeTransform(
  chunks: Part[],
  getExcerpts: () => readonly string[],
  closeInput = true,
): Promise<Part[]> {
  const transform = createGroundedAnswerStreamTransform(getExcerpts)({
    tools: {},
    stopStream: () => {},
  });
  const input = new ReadableStream<Part>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      if (closeInput) controller.close();
    },
  });
  const output = input.pipeThrough(transform);
  const reader = output.getReader();
  const out: Part[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out.push(value);
  }
  return out;
}

async function collectAssistantText(chunks: Part[], getExcerpts: () => readonly string[]): Promise<string> {
  const out = await pipeTransform(chunks, getExcerpts);
  let text = '';
  for (const part of out) {
    if (part.type === 'text-delta') text += part.text;
  }
  return text;
}

const streamParts = (body: string): Part[] => [
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

  const passthroughChunks: Part[] = [
    { type: 'text-start', id: 't0' },
    { type: 'text-delta', id: 't0', text: 'Hei ' },
    { type: 'text-delta', id: 't0', text: 'verden' },
    { type: 'text-end', id: 't0' },
  ];
  const passthroughOut = await pipeTransform(passthroughChunks, () => []);
  const passthroughDeltas = passthroughOut.filter((p) => p.type === 'text-delta');
  assert.equal(passthroughDeltas.length, 2);
  assert.equal(
    passthroughDeltas.map((p) => (p.type === 'text-delta' ? p.text : '')).join(''),
    'Hei verden',
  );

  const abortChunks: Part[] = [
    { type: 'text-start', id: 't0' },
    { type: 'text-delta', id: 't0', text: contradictory },
  ];
  const abortOut = await pipeTransform(abortChunks, () => excerpts);
  const abortText = abortOut
    .filter((p) => p.type === 'text-delta')
    .map((p) => (p.type === 'text-delta' ? p.text : ''))
    .join('');
  assert.match(abortText, /stemte SV for/i);
  assert.ok(!/stemte SV mot/i.test(abortText));
  assert.ok(abortOut.some((p) => p.type === 'text-end' && p.id === 't0'));

  const routeSrc = readFileSync(new URL('../../app/api/chat/route.ts', import.meta.url), 'utf8');
  assert.match(routeSrc, /createGroundedAnswerStreamTransform/);
  assert.match(routeSrc, /createChatRagExcerptCollector/);
  assert.match(routeSrc, /experimental_transform:/);
  assert.match(routeSrc, /abortSignal: request\.signal/);

  const chatSrc = readFileSync(
    new URL('../../components/chat/stemme-chat.tsx', import.meta.url),
    'utf8',
  );
  assert.match(chatSrc, /role="status"/);
  assert.match(chatSrc, /Skriver svar…/);

  console.log('lib/chat/stream-grounded-answer.test.ts ok');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
