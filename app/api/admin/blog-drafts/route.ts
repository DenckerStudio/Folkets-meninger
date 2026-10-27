import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import { editBlogDraft, parseEditBlogDraftBody } from '@/lib/admin/blog-draft-edit';
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ugyldig JSON' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Ugyldig JSON-body' }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const action = record.action;

  if (action === 'restore') {
    const id = typeof record.id === 'string' ? record.id : null;
    if (!id) {
      return NextResponse.json({ error: 'Mangler id eller handling' }, { status: 400 });
    }
    try {
      await restoreExpiredBlogDraft(id);
      return NextResponse.json({ ok: true, id, action });
    } catch (error) {
      console.error('blog-drafts restore failed', error);
      return NextResponse.json({ error: 'Kunne ikke gjenopprette utkast' }, { status: 500 });
    }
  }

  if (action === 'edit') {
    const parsed = parseEditBlogDraftBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    try {
      const result = await editBlogDraft(parsed.input);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json({ ok: true, id: result.id, action: 'edit' });
    } catch (error) {
      console.error('blog-drafts edit failed', error);
      return NextResponse.json({ error: 'Kunne ikke lagre endringer' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Mangler id eller handling' }, { status: 400 });
}
