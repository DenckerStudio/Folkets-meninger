import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { sendWelcomeEmail } from '@/lib/email/nodemailer';
import { isSmtpConfigured } from '@/lib/email/smtp-config';

export const dynamic = 'force-dynamic';

function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
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

    const ip = clientIp(request);
    const ipRate = await checkRateLimit(`welcome-email:ip:${ip}`, 5, 3_600_000);
    if (!ipRate.ok) {
      return NextResponse.json(
        { error: 'For mange forespørsler. Prøv igjen om litt.' },
        {
          status: 429,
          headers: { 'Retry-After': String(ipRate.retryAfterSeconds) },
        },
      );
    }

    const userRate = await checkRateLimit(`welcome-email:user:${user.id}`, 2, 3_600_000);
    if (!userRate.ok) {
      return NextResponse.json(
        { error: 'Velkomst-e-post kan bare sendes noen ganger per time. Prøv igjen senere.' },
        {
          status: 429,
          headers: { 'Retry-After': String(userRate.retryAfterSeconds) },
        },
      );
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
      return NextResponse.json({ ok: true, skipped: true, reason: 'no_email' });
    }

    if (!isSmtpConfigured()) {
      console.warn('Welcome email skipped: SMTP is not configured', { userId: user.id });
      return NextResponse.json({ ok: true, skipped: true, reason: 'smtp_not_configured' });
    }

    await sendWelcomeEmail({ to: email, name: name || null });

    await service.from('notifications').insert({
      user_id: user.id,
      type: 'welcome_email',
      channel: 'categories',
      title: 'Velkommen til Folkets Meninger',
      body: 'Takk for at du registrerte deg.',
      url: '/dashboard/utforsk',
      data: {},
      emailed_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Welcome email error', e);
    return NextResponse.json({ error: 'En feil oppstod' }, { status: 500 });
  }
}

