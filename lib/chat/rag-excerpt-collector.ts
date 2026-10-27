import type { CitationRegistry } from '@/lib/chat/citations';

/**
 * Per-request buffer of document excerpt text keyed by chat citation number (`kilde` / [n]).
 * Used to align RAG chunk text with [n] citations for party-vote post-validation.
 */
export type ChatRagExcerptCollector = {
  recordDocumentExcerpt: (kilde: number, content: string) => void;
  excerptsAlignedWithCitations: () => string[];
};

export function createChatRagExcerptCollector(registry: CitationRegistry): ChatRagExcerptCollector {
  const byKilde = new Map<number, string>();

  return {
    recordDocumentExcerpt(kilde: number, content: string) {
      const piece = content.trim();
      if (!piece || !Number.isFinite(kilde) || kilde < 1) return;
      const prev = byKilde.get(kilde);
      byKilde.set(kilde, prev ? `${prev}\n\n${piece}` : piece);
    },
    excerptsAlignedWithCitations() {
      const numbers = registry.list().map((source) => source.n);
      const max = numbers.length > 0 ? Math.max(...numbers) : 0;
      const out: string[] = [];
      for (let n = 1; n <= max; n += 1) {
        out.push(byKilde.get(n) ?? '');
      }
      return out;
    },
  };
}

export function recordDocumentExcerptsForCollector(
  collector: ChatRagExcerptCollector | null | undefined,
  chunks: readonly { kilde?: number | null; content: string }[],
): void {
  if (!collector) return;
  for (const chunk of chunks) {
    if (typeof chunk.kilde === 'number') {
      collector.recordDocumentExcerpt(chunk.kilde, chunk.content);
    }
  }
}
