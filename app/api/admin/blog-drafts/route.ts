import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import { listBlogDraftsForReview } from '@/lib/admin/blog-review';
import { isCmsConfigured } from '@/lib/cms/payload-client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!isCmsConfigured()) {
    return NextResponse.json({ drafts: [], cmsConfigured: false });
  }

  try {
    const drafts = await listBlogDraftsForReview(40);
    return NextResponse.json({ drafts, cmsConfigured: true });
  } catch (error) {
    console.error('blog-drafts list failed', error);
    return NextResponse.json({ error: 'Kunne ikke hente bloggutkast' }, { status: 500 });
  }
}
