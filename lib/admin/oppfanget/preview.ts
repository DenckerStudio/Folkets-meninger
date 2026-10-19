/** Dev-only mock preview for admin UI screenshots (?preview=mock). Never enabled in production. */
export function isOppfangetMockPreviewRequested(previewParam: string | null | undefined): boolean {
  return previewParam === 'mock';
}

export function isOppfangetMockPreviewAllowed(previewParam: string | null | undefined): boolean {
  if (!isOppfangetMockPreviewRequested(previewParam)) return false;
  if (process.env.NODE_ENV === 'production') return false;
  if (process.env.VERCEL_ENV === 'production') return false;
  return true;
}
