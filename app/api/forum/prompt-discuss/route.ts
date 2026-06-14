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

    const { prompt_id } = await request.json();
    if (!prompt_id) {
      return NextResponse.json({ error: 'Mangler prompt' }, { status: 400 });
    }

    const service = getServiceSupabase();
    const { data, error } = await service.rpc('register_prompt_discuss_click', {
      p_user_id: user.id,
      p_prompt_id: prompt_id,
    });

    if (error) {
      console.error('register_prompt_discuss_click error:', error);
      return NextResponse.json({ error: 'Kunne ikke registrere' }, { status: 500 });
    }

    const result = data as {
      click_count?: number;
      threshold?: number;
      spawned_thread_id?: string | null;
      spawned?: boolean;
    };

    return NextResponse.json({
      success: true,
      click_count: result.click_count,
      threshold: result.threshold,
      spawned_thread_id: result.spawned_thread_id,
      spawned: result.spawned,
    });
  } catch (e) {
    console.error('prompt-discuss error', e);
    return NextResponse.json({ error: 'En feil oppstod' }, { status: 500 });
  }
}
