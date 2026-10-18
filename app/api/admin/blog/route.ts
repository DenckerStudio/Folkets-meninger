import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import {
  getAdminBlogPostById,
  listAdminBlogDrafts,
  publishAdminBlogPost,
  rejectAdminBlogPost,
  updateAdminBlogPost,
} from '@/lib/blog/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ posts: [], tableReady: false });
  }

  try {
    const posts = await listAdminBlogDrafts();
    return NextResponse.json({ posts, tableReady: true });
  } catch (error) {
    console.error('[admin/blog] list failed', error);
    return NextResponse.json({ error: 'Kunne ikke laste bloggutkast.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Serveren er ikke konfigurert' }, { status: 503 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    if (!id) {
      return NextResponse.json({ error: 'Mangler id' }, { status: 400 });
    }

    const action = typeof body.action === 'string' ? body.action : '';

    if (action === 'publish') {
      const post = await publishAdminBlogPost(id);
      return NextResponse.json({ ok: true, post });
    }

    if (action === 'reject') {
      await rejectAdminBlogPost(id);
      return NextResponse.json({ ok: true, id, status: 'rejected' });
    }

    if (action === 'edit') {
      const title = typeof body.title === 'string' ? body.title : undefined;
      const excerpt = typeof body.excerpt === 'string' ? body.excerpt : undefined;
      const body_md = typeof body.body_md === 'string' ? body.body_md : undefined;
      if (title === undefined && excerpt === undefined && body_md === undefined) {
        return NextResponse.json({ error: 'Ingen felt å oppdatere' }, { status: 400 });
      }
      const existing = await getAdminBlogPostById(id);
      if (!existing) {
        return NextResponse.json({ error: 'Utkastet finnes ikke' }, { status: 404 });
      }
      await updateAdminBlogPost(id, { title, excerpt, body_md });
      const post = await getAdminBlogPostById(id);
      return NextResponse.json({ ok: true, post });
    }

    return NextResponse.json({ error: 'Ukjent action' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: 'Utkastet finnes ikke' }, { status: 404 });
    }
    console.error('[admin/blog] patch failed', error);
    return NextResponse.json({ error: 'Kunne ikke oppdatere utkastet' }, { status: 500 });
  }
}
