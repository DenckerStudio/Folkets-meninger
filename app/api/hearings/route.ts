import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { ensurePublicUser } from '@/lib/ensure-public-user';
import { PUBLIC_IDENTITY_ERROR } from '@/lib/identity/public-identity';
import { isConstructiveArgument } from '@/lib/knowledge/constructive';
import { hearingCommentAward } from '@/lib/knowledge/award';
import { syncUserBadges } from '@/lib/knowledge/service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
    }

    await ensurePublicUser(user);

    const { stortinget_hearing_id, hearing_id, body } = await request.json();
    const hearingId =
      typeof stortinget_hearing_id === 'string' && stortinget_hearing_id.trim()
        ? stortinget_hearing_id.trim()
        : typeof hearing_id === 'string'
          ? hearing_id.trim()
          : '';

    if (!hearingId || !body?.trim()) {
      return NextResponse.json({ error: 'Mangler påkrevde felt' }, { status: 400 });
    }

    const service = getServiceSupabase();
    const { data, error } = await service.rpc('create_hearing_comment', {
      p_user_id: user.id,
      p_stortinget_hearing_id: hearingId,
      p_body: body.trim(),
    });

    if (error) {
      console.error('Create hearing comment error:', error);
      const msg = String(error.message || '');
      if (msg.includes('first and last name')) {
        return NextResponse.json({ error: PUBLIC_IDENTITY_ERROR }, { status: 400 });
      }
      return NextResponse.json({ error: 'Kunne ikke publisere innspill' }, { status: 500 });
    }

    if (isConstructiveArgument(body.trim()) && data) {
      await hearingCommentAward(user.id, String(data));
      await syncUserBadges(user.id);
    }

    return NextResponse.json({ success: true, commentId: data });
  } catch (error) {
    console.error('Hearings API error:', error);
    return NextResponse.json({ error: 'En feil oppstod' }, { status: 500 });
  }
}
