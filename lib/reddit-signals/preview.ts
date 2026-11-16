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