import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { ensurePublicUser } from '@/lib/ensure-public-user';
import { isDuplicateReportError, isValidReportCategory } from '@/lib/forum/reports';
import { isValidUuid } from '@/lib/forum/validation';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
  }

  await ensurePublicUser(user);

  const body = await request.json().catch(() => ({}));
  const targetType = body.target_type;
  const targetId = body.target_id;
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : null;
  const categoryRaw = body.category;
  const category = isValidReportCategory(categoryRaw) ? categoryRaw : 'other';

  if (targetType !== 'thread' && targetType !== 'reply') {
    return NextResponse.json({ error: 'Ugyldig måltype' }, { status: 400 });
  }

  if (!isValidUuid(targetId)) {
    return NextResponse.json({ error: 'Ugyldig mål' }, { status: 400 });
  }

  const service = getServiceSupabase();
  const { error } = await service.from('forum_reports').insert({
    reporter_user_id: user.id,
    target_type: targetType,
    target_id: targetId,
    category,
    reason,
  });

  if (error) {
    if (isDuplicateReportError(error.code)) {
      return NextResponse.json(
        { error: 'Du har allerede rapportert dette innlegget' },
        { status: 409 },
      );
    }
    console.error('forum report', error);
    return NextResponse.json({ error: 'Kunne ikke sende rapport' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
