import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { getServiceSupabase } from '@/lib/supabase';
import { getServerSupabase } from '@/lib/supabase-server';
import { sendSiteFeedbackEmail } from '@/lib/email/nodemailer';

export const dynamic = 'force-dynamic';

const CATEGORIES = new Set(['idé', 'feil', 'spørsmål', 'annet']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(request: Request) {
  const rate = checkRateLimit(`feedback:${clientIp(request)}`, 5, 60_000);
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'For mange forespørsler. Prøv igjen om litt.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rate.retryAfterSeconds) },
      },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 });
  }

  // Honeypot — bots fill this; humans never see it.
  if (typeof body.company === 'string' && body.company.trim()) {
    return NextResponse.json({ ok: true });
  }

  const name =
    typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
  const email =
    typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
  const message =
    typeof body.message === 'string' ? body.message.trim().slice(0, 4000) : '';
  const categoryRaw =
    typeof body.category === 'string' ? body.category.trim() : 'annet';
  const category = CATEGORIES.has(categoryRaw) ? categoryRaw : 'annet';
  const pagePath =
    typeof body.page_path === 'string' ? body.page_path.trim().slice(0, 200) : '/innspill';

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Oppgi en gyldig e-postadresse.' }, { status: 400 });
  }
  if (message.length < 10) {
    return NextResponse.json(
      { error: 'Meldingen må være minst 10 tegn.' },
      { status: 400 },
    );
  }

  const supabaseAuth = await getServerSupabase();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Innspill er midlertidig utilgjengelig.' },
      { status: 503 },
    );
  }

  const service = getServiceSupabase();
  const { error } = await service.from('site_feedback').insert({
    name: name || null,
    email,
    category,
    message,
    user_id: user?.id ?? null,
    user_agent: request.headers.get('user-agent')?.slice(0, 400) ?? null,
    page_path: pagePath,
  });

  let persisted = !error;
  if (error) {
    console.error('[feedback] insert failed', error.message);
  }

  let emailed = false;
  try {
    await sendSiteFeedbackEmail({
      name: name || null,
      email,
      category,
      message,
    });
    emailed = true;
  } catch (emailError) {
    console.warn(
      '[feedback] email skipped',
      emailError instanceof Error ? emailError.message : emailError,
    );
  }

  if (!persisted && !emailed) {
    return NextResponse.json({ error: 'Kunne ikke sende innspill.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
