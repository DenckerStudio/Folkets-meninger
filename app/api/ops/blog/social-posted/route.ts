import { NextResponse } from 'next/server';
import { cronAuthResponse } from '@/lib/cron-auth';
import { verifyOpsSecret } from '@/lib/ops-auth';
import { parseSocialPostedBody } from '@/lib/blog/ops-payload';
import { markBlogSocialPosted } from '@/lib/blog/service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = verifyOpsSecret(request);
  if (!auth.ok) {
    return cronAuthResponse(auth);
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ugyldig JSON' }, { status: 400 });
  }

  const parsed = parseSocialPostedBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const updated = await markBlogSocialPosted(parsed.slug);
  if (!updated) {
    return NextResponse.json({ error: 'Fant ikke publisert innlegg med denne slug' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, slug: parsed.slug });
}
