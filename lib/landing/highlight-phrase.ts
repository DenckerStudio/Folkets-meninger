export type HighlightParts = {
  before: string;
  match: string;
  after: string;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Split `text` around the first whole-word occurrence of `highlight`.
 * Letter-aware so «mening» does not match inside «meningen».
 */
export function splitHighlightPhrase(text: string, highlight: string): HighlightParts | null {
  const needle = highlight.trim();
  if (!needle) return null;

  const pattern = new RegExp(`(^|[^\\p{L}])(${escapeRegExp(needle)})(?=$|[^\\p{L}])`, 'u');
  const match = pattern.exec(text);
  if (!match || match.index == null) return null;

  const prefix = match[1] ?? '';
  const start = match.index + prefix.length;
  return {
    before: text.slice(0, start),
    match: needle,
    after: text.slice(start + needle.length),
  };
}
