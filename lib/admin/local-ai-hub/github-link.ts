export function parseGithubLinkNext(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(',')) {
    const trimmed = part.trim();
    const m = /^<([^>]+)>;\s*rel="next"/i.exec(trimmed);
    if (m?.[1]) return m[1];
  }
  return null;
}