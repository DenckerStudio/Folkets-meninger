import { NextResponse } from 'next/server';
import { checkDiscussionContent } from '@/lib/moderation/content-check';
import { createDiscussionPost, listDiscussionPosts } from '@/lib/discussion/service';
import { DISCUSSION_BODY_MAX, DISCUSSION_PAGE_SIZE_MAX } from '@/lib/discussion/types';
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get('cursor');
  const limitRaw = Number.parseInt(searchParams.get('limit') ?? '', 10);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), DISCUSSION_PAGE_SIZE_MAX)
    : undefined;

  const page = await listDiscussionPosts(id, {
    cursor: cursor || null,
    limit,
  });

  return NextResponse.json(page, {
    headers: {
      'Cache-Control': 'private, no-store',
    },
  });
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
  const ipRate = checkRateLimit(`discussion:post:ip:${ip}`, 20, 60_000);
  if (!ipRate.ok) {
    return NextResponse.json(
      { error: 'For mange forespørsler. Prøv igjen om litt.' },
      {
        status: 429,
        headers: { 'Retry-After': String(ipRate.retryAfterSeconds) },
      },
    );
  }

  const userRate = checkRateLimit(`discussion:post:user:${user.id}`, 10, 60_000);
  if (!userRate.ok) {
    return NextResponse.json(
      { error: 'Du publiserer for ofte. Vent litt før du legger ut et nytt innlegg.' },
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

  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (!text) {
    return NextResponse.json({ error: 'Skriv et innlegg før du publiserer' }, { status: 400 });
  }
  if (text.length > DISCUSSION_BODY_MAX) {
    return NextResponse.json(
      { error: `Innlegget kan ikke være lengre enn ${DISCUSSION_BODY_MAX} tegn` },
      { status: 400 },
    );
  }

  const moderation = checkDiscussionContent(text);
  if (!moderation.approved) {
    return NextResponse.json({ error: moderation.reason }, { status: 400 });
  }

  try {
    await ensurePublicUser(user);
    const postId = await createDiscussionPost(user.id, id, text);
    return NextResponse.json({ success: true, postId });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const combined = message.toLowerCase();
    if (combined.includes('first and last name') || combined.includes('public identity')) {
      return NextResponse.json({ error: PUBLIC_IDENTITY_ERROR }, { status: 400 });
    }
    console.error('Create discussion post error:', error);
    return NextResponse.json({ error: 'Kunne ikke publisere innlegget' }, { status: 500 });
  }
}
