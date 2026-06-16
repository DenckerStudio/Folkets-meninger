import { stortingetUrl } from '@/lib/stortinget-utils';
import { htmlToPlainText, sanitizeStortingetHtml, wrapDocumentHtmlForDisplay } from '@/lib/html-document';

const FETCH_TIMEOUT_MS = 20_000;

export type FetchedPublikasjon = {
  html: string;
  displayHtml: string;
  plainText: string;
  mimeType: 'text/html';
};

export async function fetchPublikasjonHtml(exportId: string): Promise<FetchedPublikasjon | null> {
  const url = stortingetUrl('/eksport/publikasjon', {
    publikasjonid: exportId,
    format: 'html',
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'text/html' },
      next: { revalidate: 86_400 },
    });

    if (!response.ok) {
      console.warn(`[publikasjon] ${exportId} returned ${response.status}`);
      return null;
    }

    const rawHtml = await response.text();
    const sanitized = sanitizeStortingetHtml(rawHtml);
    if (!sanitized) return null;

    const plainText = htmlToPlainText(sanitized);
    if (!plainText) return null;

    return {
      html: sanitized,
      displayHtml: wrapDocumentHtmlForDisplay(sanitized, exportId),
      plainText,
      mimeType: 'text/html',
    };
  } catch (error) {
    console.warn(`[publikasjon] Failed to fetch ${exportId}:`, error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
