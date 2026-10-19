import { NextResponse } from 'next/server';
import { cronAuthResponse } from '@/lib/cron-auth';
import { verifyOpsSecret } from '@/lib/ops-auth';
import { parseCreateBlogDraftBody } from '@/lib/blog/ops-payload';
import { createBlogDraft } from '@/lib/blog/service';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = verifyOpsSecret(request);
  if (!auth.ok) {
    return cronAuthResponse(auth);
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

  try {
    const result = await createBlogDraft(parsed.input);
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          ...(result.id ? { id: result.id } : {}),
          ...(result.slug ? { slug: result.slug } : {}),
          ...(result.adminUrl ? { adminUrl: result.adminUrl } : {}),
        },
        { status: result.status },
      );
    }

    return NextResponse.json({
      id: result.id,
      slug: result.slug,
      created: result.created,
      adminUrl: result.adminUrl,
    });
  } catch (error) {
    console.error('[ops/blog/drafts]', error);
    return NextResponse.json(
      { error: 'Uventet serverfeil ved opprettelse av bloggutkast' },
      { status: 500 },
    );
  }
}
