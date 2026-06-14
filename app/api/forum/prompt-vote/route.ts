import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { ensurePublicUser } from '@/lib/ensure-public-user';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
    }

    await ensurePublicUser(user);

    const { prompt_id, option_id } = await request.json();
    if (!prompt_id || !option_id) {
      return NextResponse.json({ error: 'Mangler prompt eller alternativ' }, { status: 400 });
    }

    const service = getServiceSupabase();
    const { data, error } = await service.rpc('cast_prompt_vote', {
      p_user_id: user.id,
      p_prompt_id: prompt_id,
      p_option_id: option_id,
    });

    if (error) {
      console.error('cast_prompt_vote error:', error);
      return NextResponse.json({ error: 'Kunne ikke registrere stemme' }, { status: 500 });
    }

    const result = data as { total?: number; options?: unknown[] };
    return NextResponse.json({
      success: true,
      total: result.total,
      options: result.options,
    });
  } catch (e) {
    console.error('prompt-vote error', e);
    return NextResponse.json({ error: 'En feil oppstod' }, { status: 500 });
  }
}
