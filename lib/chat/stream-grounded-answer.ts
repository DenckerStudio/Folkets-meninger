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

/**
 * Buffers each assistant text block until `text-end`, then emits a single corrected
 * `text-delta` (mirrors eval post-generation semantics without mutating mid-stream tokens).
 */
export function createGroundedAnswerStreamTransform<TOOLS extends ToolSet>(
  getExcerpts: () => readonly string[],
): StreamTextTransform<TOOLS> {
  return () => {
    let activeTextId: string | null = null;
    let stepBuffer = '';

    return new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      transform(chunk, controller) {
        switch (chunk.type) {
          case 'text-start':
            activeTextId = chunk.id;
            stepBuffer = '';
            controller.enqueue(chunk);
            return;
          case 'text-delta':
            if (chunk.id === activeTextId) {
              stepBuffer += chunk.text;
              return;
            }
            controller.enqueue(chunk);
            return;
          case 'text-end':
            if (chunk.id === activeTextId) {
              const processed = applyStreamedGroundedPostProcess(stepBuffer, getExcerpts());
              if (processed.length > 0) {
                controller.enqueue({
                  type: 'text-delta',
                  id: chunk.id,
                  text: processed,
                });
              }
              activeTextId = null;
              stepBuffer = '';
            }
            controller.enqueue(chunk);
            return;
          default:
            controller.enqueue(chunk);
        }
      },
    });
  };
}
