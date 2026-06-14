import { NextResponse } from 'next/server';
import { getAnonSupabase, getServiceSupabase } from '@/lib/supabase';
import { getRepresentanterForPeriode, getSaker } from '@/lib/stortinget';
import {
  hearingContextItem,
  politicianContextItem,
  sakContextItem,
  type ForumContextItem,
} from '@/lib/forum/context';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

type SearchKind = 'all' | 'sak' | 'hearing' | 'politician';

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase();
}

async function searchSaker(q: string, limit: number): Promise<ForumContextItem[]> {
  const items: ForumContextItem[] = [];

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const service = getServiceSupabase();
    let query = service.from('stortinget_issues').select('id,title,status').limit(limit);

    if (q) {
      query = query.ilike('title', `%${q}%`);
    }

    const { data } = await query.order('last_synced_at', { ascending: false });
    for (const row of data || []) {
      items.push(sakContextItem(row.id, row.title || `Sak ${row.id}`, row.status === 'closed' ? 'Ferdigbehandlet' : 'Under behandling'));
    }
  }

  if (items.length < 5 && q.length >= 2) {
    try {
      const live = await getSaker();
      const filtered = live
        .filter((s) => `${s.title} ${s.summary || ''}`.toLowerCase().includes(q))
        .slice(0, limit - items.length);

      for (const sak of filtered) {
        if (items.some((i) => i.kind === 'sak' && i.id === sak.id)) continue;
        items.push(
          sakContextItem(sak.id, sak.title || `Sak ${sak.id}`, sak.status === 'closed' ? 'Ferdigbehandlet' : 'Under behandling')
        );
      }

      if (process.env.SUPABASE_SERVICE_ROLE_KEY && filtered.length > 0) {
        const service = getServiceSupabase();
        const now = new Date().toISOString();
        void service.from('stortinget_issues').upsert(
          filtered.map((s) => ({
            id: String(s.id),
            title: s.title,
            summary: s.summary || null,
            status: s.status || 'pending',
            last_synced_at: now,
          })),
          { onConflict: 'id' }
        );
      }
    } catch (e) {
      console.error('context-search live fallback error', e);
    }
  }

  if (items.length === 0 && q.length >= 2) {
    const anon = getAnonSupabase();
    const { data } = await anon
      .from('stortinget_issues')
      .select('id,title,status')
      .ilike('title', `%${q}%`)
      .limit(limit);

    for (const row of data || []) {
      items.push(sakContextItem(row.id, row.title || `Sak ${row.id}`));
    }
  }

  return items.slice(0, limit);
}

async function searchHearings(q: string, limit: number): Promise<ForumContextItem[]> {
  try {
    const res = await fetch('https://data.stortinget.no/eksport/horinger?format=json', {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];

    const data = await res.json();
    const list = data.horinger_liste || [];

    return list
      .map((hearing: Record<string, unknown>) => {
        const id = String(hearing.id ?? '');
        const title =
          (hearing.horing_sak_info_liste as { sak_tittel?: string }[] | undefined)?.[0]?.sak_tittel ||
          'Høring uten tittel';
        const komite = (hearing.komite as { navn?: string } | undefined)?.navn || null;
        const status = String(hearing.horing_status || '');
        return hearingContextItem(id, title, komite || status);
      })
      .filter((item: ForumContextItem) => {
        if (!q) return true;
        const haystack = `${item.title} ${item.subtitle || ''}`.toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, limit);
  } catch {
    return [];
  }
}

async function searchPoliticians(q: string, limit: number): Promise<ForumContextItem[]> {
  const reps = await getRepresentanterForPeriode();

  return reps
    .map((rep) => {
      const name = `${rep.fornavn} ${rep.etternavn}`.trim();
      return politicianContextItem(rep.id, name, rep.parti?.navn);
    })
    .filter((item) => {
      if (!q) return true;
      const haystack = `${item.title} ${item.meta || ''} ${item.subtitle || ''}`.toLowerCase();
      return haystack.includes(q);
    })
    .slice(0, limit);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = normalizeQuery(searchParams.get('q') || '');
  const kind = (searchParams.get('type') || 'all') as SearchKind;
  const limit = Math.min(Number(searchParams.get('limit') || 8), 20);

  if (q.length === 1) {
    return NextResponse.json({ results: [] });
  }

  const tasks: Promise<ForumContextItem[]>[] = [];

  if (kind === 'all' || kind === 'sak') {
    tasks.push(searchSaker(q, limit));
  }
  if (kind === 'all' || kind === 'hearing') {
    tasks.push(searchHearings(q, limit));
  }
  if (kind === 'all' || kind === 'politician') {
    tasks.push(searchPoliticians(q, limit));
  }

  const groups = await Promise.all(tasks);
  const results = groups.flat().slice(0, limit);

  return NextResponse.json({
    results,
    quickLinks: [
      { label: 'Utforsk saker', href: routes.utforsk },
      { label: 'Høringer', href: routes.horinger },
      { label: 'Politikere', href: routes.politikere },
    ],
  });
}
