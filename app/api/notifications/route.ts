import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
    }

    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200);

    const { data, error } = await supabase
      .from('notifications')
      .select('id,type,channel,title,body,url,data,created_at,read_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Notifications list error', error);
      return NextResponse.json({ error: 'Kunne ikke hente varsler' }, { status: 500 });
    }

    return NextResponse.json({ notifications: data || [] });
  } catch (e) {
    console.error('Notifications API error', e);
    return NextResponse.json({ error: 'En feil oppstod' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
    }

    const payload = await request.json();
    const action = payload?.action;

    if (action === 'mark_read') {
      const ids = Array.isArray(payload.ids) ? payload.ids : [];
      if (ids.length === 0) return NextResponse.json({ ok: true });

      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .in('id', ids)
        .is('read_at', null);

      if (error) {
        console.error('Mark read error', error);
        return NextResponse.json({ error: 'Kunne ikke markere som lest' }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    if (action === 'mark_all_read') {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null);

      if (error) {
        console.error('Mark all read error', error);
        return NextResponse.json({ error: 'Kunne ikke markere alle som lest' }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Ukjent handling' }, { status: 400 });
  } catch (e) {
    console.error('Notifications API error', e);
    return NextResponse.json({ error: 'En feil oppstod' }, { status: 500 });
  }
}

