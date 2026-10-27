import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import {
  listBlogDraftsForReview,
  listExpiredBlogDraftsForReview,
  restoreExpiredBlogDraft,
} from '@/lib/admin/blog-review';
import { isCmsConfigured } from '@/lib/cms/payload-client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!isCmsConfigured()) {
    return NextResponse.json({ drafts: [], cmsConfigured: false });
  }

  const url = new URL(request.url);
  const queue = url.searchParams.get('queue') === 'expired' ? 'expired' : 'pending';

  try {
    const drafts =
      queue === 'expired'
        ? await listExpiredBlogDraftsForReview(40)
        : await listBlogDraftsForReview(40);
    return NextResponse.json({ drafts, cmsConfigured: true, queue });
  } catch (error) {
    console.error('blog-drafts list failed', error);
    return NextResponse.json({ error: 'Kunne ikke hente bloggutkast' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!isCmsConfigured()) {
    return NextResponse.json({ error: 'Blogg er ikke tilgjengelig' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const id = typeof body.id === 'string' ? body.id : null;
    const action = body.action === 'restore' ? body.action : null;
    if (!id || !action) {
      return NextResponse.json({ error: 'Mangler id eller handling' }, { status: 400 });
    }

    await restoreExpiredBlogDraft(id);
    return NextResponse.json({ ok: true, id, action });
  } catch (error) {
    console.error('blog-drafts restore failed', error);
    return NextResponse.json({ error: 'Kunne ikke gjenopprette utkast' }, { status: 500 });
  }
}
