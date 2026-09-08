import { NextResponse } from 'next/server';
import { checkDiscussionContent } from '@/lib/moderation/content-check';
import { createCitizenOpinion, listCitizenOpinions } from '@/lib/opinions/service';
import { OPINION_LIST_PAGE_SIZE } from '@/lib/opinions/types';
import { hasOpinionFieldErrors, parseOpinionPoints, validateOpinionDraft } from '@/lib/opinions/validate';
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

export async function GET() {
  const opinions = await listCitizenOpinions(OPINION_LIST_PAGE_SIZE);
  return NextResponse.json(
    { opinions },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    },
  );
}

export async function POST(request: Request) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
  }

  const ip = clientIp(request);
  const ipRate = checkRateLimit(`opinions:create:ip:${ip}`, 12, 60_000);
  if (!ipRate.ok) {
    return NextResponse.json(
      { error: 'For mange forespørsler. Prøv igjen om litt.' },
      {
        status: 429,
        headers: { 'Retry-After': String(ipRate.retryAfterSeconds) },
      },
    );
  }

  const userRate = checkRateLimit(`opinions:create:user:${user.id}`, 6, 60_000);
  if (!userRate.ok) {
    return NextResponse.json(
      { error: 'Du publiserer for ofte. Vent litt før du deler en ny mening.' },
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

  const title = typeof body.title === 'string' ? body.title : '';
  const text = typeof body.body === 'string' ? body.body : '';
  const stance = body.stance;
  const points = body.points;
  const stortingetIssueId = typeof body.stortingetIssueId === 'string' ? body.stortingetIssueId : null;

  const fieldErrors = validateOpinionDraft({ title, body: text, stance, points });
  if (hasOpinionFieldErrors(fieldErrors)) {
    return NextResponse.json(
      {
        error: fieldErrors.title || fieldErrors.body || fieldErrors.stance || fieldErrors.points,
        fieldErrors,
      },
      { status: 400 },
    );
  }

  const moderation = checkDiscussionContent(
    `${title}\n${text}\n${parseOpinionPoints(points)
      .map((point) => point.text)
      .join('\n')}`,
  );
  if (!moderation.approved) {
    return NextResponse.json({ error: moderation.reason }, { status: 400 });
  }

  try {
    await ensurePublicUser(user);
    const opinionId = await createCitizenOpinion(user.id, {
      title,
      body: text,
      stance,
      points,
      stortingetIssueId,
    });
    return NextResponse.json({ success: true, opinionId });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const combined = message.toLowerCase();
    if (combined.includes('first and last name') || combined.includes('public identity')) {
      return NextResponse.json({ error: PUBLIC_IDENTITY_ERROR }, { status: 400 });
    }
    console.error('Create citizen opinion error:', error);
    return NextResponse.json({ error: 'Kunne ikke publisere meningen' }, { status: 500 });
  }
}
