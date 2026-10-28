import { truncateDescription } from '@/lib/seo/metadata';

/** `og:description` for a mening; the share dialog preview uses the same text. */
export function opinionShareDescription(opinion: { title: string; body: string | null }): string {
  const body = opinion.body?.trim() ?? '';
  if (body) return truncateDescription(body);
  const title = (opinion.title || 'Mening').trim();
  return `Les meningen «${truncateDescription(title, 90)}» på Folkets Meninger.`;
}
