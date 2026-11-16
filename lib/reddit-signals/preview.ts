export function isRedditSignalsFixturePreviewRequested(
  previewParam: string | null | undefined,
): boolean {
  return previewParam === 'fixture';
}

export function isRedditSignalsFixturePreviewAllowed(
  previewParam: string | null | undefined,
): boolean {
  if (!isRedditSignalsFixturePreviewRequested(previewParam)) return false;
  if (process.env.NODE_ENV === 'production') return false;
  if (process.env.VERCEL_ENV === 'production') return false;
  return true;
}

/** Behold `preview=fixture` på Research-fanelinker (kun utvikling). */
export function appendResearchFixturePreview(
  href: string,
  devPreview?: string | null,
): string {
  if (devPreview !== 'fixture') return href;
  const qIndex = href.indexOf('?');
  const path = qIndex >= 0 ? href.slice(0, qIndex) : href;
  const params = new URLSearchParams(qIndex >= 0 ? href.slice(qIndex + 1) : '');
  params.set('preview', 'fixture');
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}