import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { sendWelcomeEmail } from '@/lib/email/nodemailer';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
    }

    // Only send once (best-effort): record via notifications table.
    const service = getServiceSupabase();
    const { data: existing } = await service
      .from('notifications')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', 'welcome_email')
      .limit(1);
    if (existing && existing.length > 0) {
      return NextResponse.json({ ok: true, alreadySent: true });
    }

    const adminUser = await service.auth.admin.getUserById(user.id);
    const email = adminUser.data.user?.email;
    const name = (adminUser.data.user?.user_metadata as any)?.full_name as string | undefined;

    if (!email) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    await sendWelcomeEmail({ to: email, name: name || null });

    await service.from('notifications').insert({
      user_id: user.id,
      type: 'welcome_email',
      channel: 'mentions',
      title: 'Velkommen til Folkets Stemme',
      body: 'Takk for at du registrerte deg.',
      url: '/dashboard/min-side',
      data: {},
      emailed_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Welcome email error', e);
    return NextResponse.json({ error: 'En feil oppstod' }, { status: 500 });
  }
}

