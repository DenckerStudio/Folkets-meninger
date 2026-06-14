import { routes } from '@/lib/routes';

export type ForumContextKind = 'sak' | 'hearing' | 'politician' | 'document';

export type ForumContextItem = {
  kind: ForumContextKind;
  id: string;
  title: string;
  subtitle?: string | null;
  href: string;
  meta?: string | null;
};

export function contextItemKey(item: Pick<ForumContextItem, 'kind' | 'id'>): string {
  return `${item.kind}:${item.id}`;
}

export function formatContextLine(item: ForumContextItem): string {
  switch (item.kind) {
    case 'sak':
      return `📋 Stortingssak: ${item.title} — ${item.href}`;
    case 'hearing':
      return `📢 Høring: ${item.title} — ${item.href}`;
    case 'politician':
      return `👤 Politiker: @${item.title}${item.meta ? ` (${item.meta})` : ''}${item.href ? ` — ${item.href}` : ''}`;
    case 'document':
      return `📄 Dokument: ${item.title}${item.href ? ` — ${item.href}` : ''}`;
    default:
      return item.title;
  }
}

export function insertContextIntoBody(body: string, item: ForumContextItem): string {
  const line = formatContextLine(item);
  const trimmed = body.trimEnd();
  if (!trimmed) return `${line}\n`;
  return `${trimmed}\n\n${line}\n`;
}

export function removeContextFromBody(body: string, item: ForumContextItem): string {
  const line = formatContextLine(item);
  const escaped = line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\n?\\n?${escaped}\\n?`, 'g');
  return body.replace(pattern, '\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}

export function sakContextItem(id: string, title: string, subtitle?: string | null): ForumContextItem {
  return {
    kind: 'sak',
    id,
    title,
    subtitle,
    href: routes.sak(id),
  };
}

export function hearingContextItem(id: string, title: string, subtitle?: string | null): ForumContextItem {
  return {
    kind: 'hearing',
    id,
    title,
    subtitle,
    href: routes.horing(id),
  };
}

export function politicianContextItem(
  id: string,
  name: string,
  party?: string | null
): ForumContextItem {
  return {
    kind: 'politician',
    id,
    title: name,
    subtitle: party,
    meta: party ?? null,
    href: `https://www.stortinget.no/no/Representanter-og-komiteer/Representant/?repId=${id}`,
  };
}

export function documentContextItem(title: string, href?: string | null): ForumContextItem {
  return {
    kind: 'document',
    id: title,
    title,
    href: href || '',
  };
}
