import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { normalizeAiLabels } from '@/lib/ai-summary/normalize-labels';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('notification_label_subscriptions')
      .select('label')
      .eq('user_id', user.id)
      .order('label', { ascending: true });

    if (error) {
      console.error('Labels GET error', error);
      return NextResponse.json({ error: 'Kunne ikke hente emne-abonnementer' }, { status: 500 });
    }

    return NextResponse.json({ labels: (data || []).map((r) => r.label) });
  } catch (e) {
    console.error('Labels GET error', e);
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
    const labels = Array.isArray(payload.labels) ? payload.labels : [];
    const cleaned = normalizeAiLabels(labels);

    const { error: delError } = await supabase
      .from('notification_label_subscriptions')
      .delete()
      .eq('user_id', user.id);
    if (delError) {
      console.error('Labels delete error', delError);
      return NextResponse.json({ error: 'Kunne ikke lagre emne-abonnementer' }, { status: 500 });
    }

    if (cleaned.length > 0) {
      const { error: insError } = await supabase
        .from('notification_label_subscriptions')
        .insert(cleaned.map((label) => ({ user_id: user.id, label })));
      if (insError) {
        console.error('Labels insert error', insError);
        return NextResponse.json({ error: 'Kunne ikke lagre emne-abonnementer' }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, labels: cleaned });
  } catch (e) {
    console.error('Labels POST error', e);
    return NextResponse.json({ error: 'En feil oppstod' }, { status: 500 });
  }
}
