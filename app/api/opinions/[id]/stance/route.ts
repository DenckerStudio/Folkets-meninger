import { NextResponse } from 'next/server';
import { checkDiscussionContent } from '@/lib/moderation/content-check';
import { createCitizenOpinionReply } from '@/lib/opinions/service';
import { hasOpinionFieldErrors, validateReplyDraft } from '@/lib/opinions/validate';
import { ensurePublicUser } from '@/lib/ensure-public-user';
import { PUBLIC_IDENTITY_ERROR } from '@/lib/identity/public-identity';
import { checkRateLimit } from '@/lib/rate-limit';
import { getServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
  }

  const ip = clientIp(request);
  const ipRate = checkRateLimit(`opinions:reply:ip:${ip}`, 20, 60_000);
  if (!ipRate.ok) {
    return NextResponse.json(
      { error: 'For mange forespørsler. Prøv igjen om litt.' },
      {
        status: 429,
        headers: { 'Retry-After': String(ipRate.retryAfterSeconds) },
      },
    );
  }

  const userRate = checkRateLimit(`opinions:reply:user:${user.id}`, 10, 60_000);
  if (!userRate.ok) {
    return NextResponse.json(
      { error: 'Du svarer for ofte. Vent litt før du publiserer på nytt.' },
      {
        status: 429,
        headers: { 'Retry-After': String(userRate.retryAfterSeconds) },
      },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 });
  }

  const text = typeof body.body === 'string' ? body.body : '';
  const stance = body.stance;
  const fieldErrors = validateReplyDraft({ body: text, stance });
  if (hasOpinionFieldErrors(fieldErrors)) {
    return NextResponse.json(
      { error: fieldErrors.body || fieldErrors.stance, fieldErrors },
      { status: 400 },
    );
  }

  const moderation = checkDiscussionContent(text);
  if (!moderation.approved) {
    return NextResponse.json({ error: moderation.reason }, { status: 400 });
  }

  try {
    await ensurePublicUser(user);
    const replyId = await createCitizenOpinionReply(user.id, id, { body: text, stance });
    return NextResponse.json({ success: true, replyId });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const combined = message.toLowerCase();
    if (combined.includes('first and last name') || combined.includes('public identity')) {
      return NextResponse.json({ error: PUBLIC_IDENTITY_ERROR }, { status: 400 });
    }
    if (combined.includes('your own opinion')) {
      return NextResponse.json({ error: 'Du kan ikke svare på din egen mening' }, { status: 400 });
    }
    if (combined.includes('not found')) {
      return NextResponse.json({ error: 'Meningen ble ikke funnet' }, { status: 404 });
    }
    console.error('Create citizen opinion reply error:', error);
    return NextResponse.json({ error: 'Kunne ikke lagre svaret' }, { status: 500 });
  }
}
