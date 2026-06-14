import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSakDetail } from '@/lib/stortinget';
import {
  documentContextItem,
  hearingContextItem,
  sakContextItem,
  type ForumContextItem,
} from '@/lib/forum/context';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const service = getServiceSupabase();
  const { data: issue } = await service
    .from('stortinget_issues')
    .select('id,title,status')
    .eq('id', id)
    .maybeSingle();

  const suggestions: ForumContextItem[] = [];
  const related: ForumContextItem[] = [];

  if (issue?.title) {
    suggestions.push(sakContextItem(id, issue.title));
  }

  const { data: dbHearings } = await service
    .from('hearings')
    .select('id,title,deadline')
    .eq('stortinget_issue_id', id)
    .limit(5);

  for (const h of dbHearings || []) {
    related.push(hearingContextItem(h.id, h.title, h.deadline ? 'Frist satt' : null));
  }

  try {
    const detail = await getSakDetail(id);
    if (detail) {
      if (detail.henvisning) {
        related.push(
          documentContextItem(
            detail.henvisning,
            `https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/?id=${id}`
          )
        );
      }

      const relations = detail.sak_relasjon_liste || [];
      for (const rel of relations.slice(0, 4)) {
        const relId = String(rel.sak_id || rel.id || '');
        const relTitle = rel.tittel || rel.korttittel || `Sak ${relId}`;
        if (relId && relId !== id) {
          related.push(sakContextItem(relId, relTitle, 'Relatert sak'));
        }
      }

      const komiteNavn = typeof detail.komite === 'object' ? detail.komite?.navn : detail.komite;
      if (komiteNavn) {
        related.push({
          kind: 'document',
          id: `komite-${id}`,
          title: `Komité: ${komiteNavn}`,
          href: routes.sak(id),
          subtitle: 'Se saksdetaljer',
        });
      }
    }
  } catch {
    // Non-fatal — cached issue data is enough
  }

  return NextResponse.json({
    sak: issue
      ? {
          id: issue.id,
          title: issue.title,
          status: issue.status,
          links: {
            sak: routes.sak(id),
            vote: routes.sak(id),
            discussions: `${routes.forum}?sak=${id}`,
          },
        }
      : null,
    related: related.slice(0, 8),
    suggestions,
  });
}
