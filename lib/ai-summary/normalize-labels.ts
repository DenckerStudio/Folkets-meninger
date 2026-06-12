/** Normalize AI label strings for storage and matching. */
export function normalizeAiLabels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of raw) {
    const label = String(item ?? '')
      .trim()
      .replace(/\s+/g, ' ');
    if (label.length < 2 || label.length > 48) continue;

    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const formatted =
      label.charAt(0).toUpperCase() + label.slice(1);
    out.push(formatted);
    if (out.length >= 5) break;
  }

  return out;
}

export function parseTopicCards(raw: unknown): { title: string; body: string }[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((card) => {
      if (!card || typeof card !== 'object') return null;
      const c = card as { title?: unknown; body?: unknown };
      const title = String(c.title ?? '').trim();
      const body = String(c.body ?? '').trim();
      if (!title || !body) return null;
      return {
        title: title.slice(0, 80),
        body: body.slice(0, 600),
      };
    })
    .filter((c): c is { title: string; body: string } => c !== null)
    .slice(0, 3);
}
