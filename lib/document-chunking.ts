const DEFAULT_CHUNK_SIZE = 1400;
const DEFAULT_OVERLAP = 80;

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function chunkDocumentText(
  text: string,
  options: { chunkSize?: number; overlap?: number } = {}
): string[] {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options.overlap ?? DEFAULT_OVERLAP;
  const normalized = normalizeWhitespace(text);
  if (!normalized) return [];
  if (normalized.length <= chunkSize) return [normalized];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + chunkSize, normalized.length);
    if (end < normalized.length) {
      const slice = normalized.slice(start, end);
      const lastBreak = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
      if (lastBreak > chunkSize * 0.5) {
        end = start + lastBreak + 1;
      }
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);

    if (end >= normalized.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

export const DOCUMENT_CHUNK_DEFAULTS = {
  chunkSize: DEFAULT_CHUNK_SIZE,
  overlap: DEFAULT_OVERLAP,
} as const;
