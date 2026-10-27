import type { StreamTextTransform, TextStreamPart, ToolSet } from 'ai';
import { postProcessGroundedAnswer } from '@/lib/chat/grounded-answer';

/**
 * Post-process assistant text from the Stemme+ chat stream with the same rules as
 * `generateRagAnswer` (polish, refusal citation strip, party-vote guard).
 */
export function applyStreamedGroundedPostProcess(answer: string, excerpts: readonly string[]): string {
  if (!answer.trim()) return answer;
  if (excerpts.length === 0) return answer;
  return postProcessGroundedAnswer(answer, [...excerpts]);
}

/** True when at least one collected RAG document excerpt has text (party-vote guard may apply). */
export function shouldBufferStreamGroundedPostProcess(excerpts: readonly string[]): boolean {
  return excerpts.some((excerpt) => excerpt.trim().length > 0);
}

type BlockState<TOOLS extends ToolSet> = {
  activeTextId: string | null;
  stepBuffer: string;
  stepBuffering: boolean;
  textEndEmitted: boolean;
};

function createBlockState(): BlockState<ToolSet> {
  return {
    activeTextId: null,
    stepBuffer: '',
    stepBuffering: false,
    textEndEmitted: false,
  };
}

function emitProcessedBuffer<TOOLS extends ToolSet>(
  controller: TransformStreamDefaultController<TextStreamPart<TOOLS>>,
  state: BlockState<TOOLS>,
  getExcerpts: () => readonly string[],
): void {
  if (!state.activeTextId || !state.stepBuffering) return;
  const processed = applyStreamedGroundedPostProcess(state.stepBuffer, getExcerpts());
  if (processed.length > 0) {
    controller.enqueue({
      type: 'text-delta',
      id: state.activeTextId,
      text: processed,
    });
  }
}

function flushActiveTextBlock<TOOLS extends ToolSet>(
  controller: TransformStreamDefaultController<TextStreamPart<TOOLS>>,
  state: BlockState<TOOLS>,
  getExcerpts: () => readonly string[],
): void {
  if (!state.activeTextId || state.textEndEmitted) return;
  emitProcessedBuffer(controller, state, getExcerpts);
  controller.enqueue({
    type: 'text-end',
    id: state.activeTextId,
  });
  state.textEndEmitted = true;
  state.activeTextId = null;
  state.stepBuffer = '';
  state.stepBuffering = false;
}

/**
 * Buffers assistant text until `text-end` when RAG excerpts exist (party-vote guard).
 * Otherwise passes `text-delta` through immediately. `flush()` emits buffered text on abort.
 */
export function createGroundedAnswerStreamTransform<TOOLS extends ToolSet>(
  getExcerpts: () => readonly string[],
): StreamTextTransform<TOOLS> {
  return () => {
    const state = createBlockState() as BlockState<TOOLS>;

    return new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      transform(chunk, controller) {
        switch (chunk.type) {
          case 'text-start':
            state.activeTextId = chunk.id;
            state.stepBuffer = '';
            state.textEndEmitted = false;
            state.stepBuffering = shouldBufferStreamGroundedPostProcess(getExcerpts());
            controller.enqueue(chunk);
            return;
          case 'text-delta':
            if (chunk.id === state.activeTextId && state.stepBuffering) {
              state.stepBuffer += chunk.text;
              return;
            }
            controller.enqueue(chunk);
            return;
          case 'text-end':
            if (chunk.id === state.activeTextId) {
              if (state.stepBuffering) {
                emitProcessedBuffer(controller, state, getExcerpts);
              }
              state.textEndEmitted = true;
              state.activeTextId = null;
              state.stepBuffer = '';
              state.stepBuffering = false;
            }
            controller.enqueue(chunk);
            return;
          default:
            controller.enqueue(chunk);
        }
      },
      flush(controller) {
        flushActiveTextBlock(controller, state, getExcerpts);
      },
    });
  };
}
