/**
 * Plain-text preview for RAG chunk cards (Docling markdown in DB).
 */
export function formatChunkExcerptForDisplay(raw: string): string {
  const withoutComments = raw.replace(/<!--[\s\S]*?-->/g, '');
  const lines = withoutComments.split('\n');
  const out: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push('');
      continue;
    }
    if (/^#{1,6}\s+/.test(trimmed)) {
      out.push(trimmed.replace(/^#{1,6}\s+/, '').trim());
      continue;
    }
    if (/^\|.+\|\s*$/.test(trimmed)) {
      if (/^\|[\s:|-]+\|\s*$/.test(trimmed)) continue;
      const cells = trimmed
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean);
      if (cells.length > 0) out.push(cells.join(' · '));
      continue;
    }
    out.push(trimmed);
  }

  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
