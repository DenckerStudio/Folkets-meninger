import { NextResponse } from 'next/server';
import { cronAuthResponse } from '@/lib/cron-auth';
import { verifyOpsSecret } from '@/lib/ops-auth';
import { parseCreateBlogDraftBody } from '@/lib/blog/ops-payload';
import { createBlogDraft } from '@/lib/blog/service';
import { adminBlogPostUrl } from '@/lib/blog/urls';

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

  const parsed = parseCreateBlogDraftBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await createBlogDraft(parsed.input, adminBlogPostUrl);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    id: result.id,
    slug: result.slug,
    created: result.created,
    adminUrl: result.adminUrl,
  });
}
