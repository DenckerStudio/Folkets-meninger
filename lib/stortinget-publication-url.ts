/** Derive Stortinget `publikasjonid` from a publication page URL (hearing sak_publikasjon or lenke_url). */
export function exportIdFromPublicationUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const normalized = url.trim().startsWith('//') ? `https:${url.trim()}` : url.trim();
  const publikasjonParam = normalized.match(/publikasjonid=([^&]+)/i)?.[1]?.trim();
  if (publikasjonParam) return publikasjonParam;

  const path = normalized.split('?')[0]?.replace(/\/+$/, '') ?? '';
  const last = path.split('/').filter(Boolean).pop()?.toLowerCase() ?? '';
  if (!last || last.length < 4) return null;
  if (/^(prop|prp|dok8|inns|refs|refe|meld|dok)[a-z0-9-]+$/i.test(last)) return last;
  return null;
}
