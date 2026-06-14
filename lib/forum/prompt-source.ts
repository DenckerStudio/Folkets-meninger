export type PromptSourceHeadline = {
  title: string;
  url: string;
  outlet: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  publishedAt?: string | null;
};

export function parsePromptSources(raw: unknown): PromptSourceHeadline[] {
  if (!Array.isArray(raw)) return [];
  const out: PromptSourceHeadline[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const title = String(row.title ?? '').trim();
    const url = String(row.url ?? row.link ?? '').trim();
    const outlet = String(row.outlet ?? 'Nyhet').trim();
    if (!title || !url) continue;
    out.push({
      title,
      url,
      outlet,
      imageUrl: row.imageUrl ? String(row.imageUrl) : null,
      videoUrl: row.videoUrl ? String(row.videoUrl) : null,
      publishedAt: row.publishedAt ? String(row.publishedAt) : null,
    });
  }
  return out;
}

export function getPromptSourceDateRange(sources: PromptSourceHeadline[]): string | null {
  const dates = sources
    .map((s) => (s.publishedAt ? new Date(s.publishedAt).getTime() : NaN))
    .filter((t) => !Number.isNaN(t));
  if (dates.length < 2) return null;
  const min = new Date(Math.min(...dates));
  const max = new Date(Math.max(...dates));
  if (max.getTime() - min.getTime() < 3 * 24 * 60 * 60 * 1000) return null;
  const fmt = (d: Date) =>
    d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
  return `Dekket ${fmt(min)} – ${fmt(max)}`;
}

export function getPromptPrimaryMedia(sources: PromptSourceHeadline[]) {
  for (const source of sources) {
    if (source.videoUrl) {
      return {
        type: 'video' as const,
        url: source.videoUrl,
        posterUrl: source.imageUrl ?? null,
        articleUrl: source.url,
      };
    }
  }
  for (const source of sources) {
    if (source.imageUrl) {
      return { type: 'image' as const, url: source.imageUrl, articleUrl: source.url };
    }
  }
  return null;
}
