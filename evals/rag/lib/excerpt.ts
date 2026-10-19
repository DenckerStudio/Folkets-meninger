import type { ChatDocumentChunk } from '@/lib/chat/rag';

const DEFAULT_CLIP = 1400;
const PER_CHUNK_CAP = Number(process.env.RAG_EVAL_EXCERPT_PER_CHUNK ?? 4800);
const TOTAL_CAP = Number(process.env.RAG_EVAL_EXCERPT_TOTAL ?? 16000);

export type ExcerptMode = 'stack_buggy' | 'stack_fixed';

/**
 * Mirrors #177 friction: re-sort by raw rank drops low semantic scores (0–1) vs lexical (10+).
 * `stack_fixed` normalizes semantic rank to 0–100 scale before budget packing.
 */
export function applyChunkExcerptsForChat(
  chunks: ChatDocumentChunk[],
  mode: ExcerptMode = 'stack_buggy',
): ChatDocumentChunk[] {
  const clip = Number(process.env.RAG_EVAL_CHUNK_CLIP ?? DEFAULT_CLIP);
  const scored = chunks.map((chunk) => {
    let rank = chunk.rank ?? 0;
    if (mode === 'stack_fixed' && rank <= 1.5) {
      rank = rank * 100;
    }
    return { chunk, rank };
  });

  scored.sort((a, b) => b.rank - a.rank || a.chunk.chunkIndex - b.chunk.chunkIndex);

  const out: ChatDocumentChunk[] = [];
  let total = 0;
  for (const { chunk, rank } of scored) {
    const content = chunk.content.replace(/\s+/g, ' ').trim().slice(0, Math.min(clip, PER_CHUNK_CAP));
    if (!content) continue;
    if (total + content.length > TOTAL_CAP) break;
    total += content.length;
    out.push({ ...chunk, content, rank });
  }
  return out;
}

export function clipChunkContent(content: string, max = DEFAULT_CLIP): string {
  return content.replace(/\s+/g, ' ').trim().slice(0, max);
}
