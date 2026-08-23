import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import { archivePoll, listSystemPollDrafts, publishPoll } from '@/lib/polls/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const drafts = await listSystemPollDrafts(50);
  return NextResponse.json({ drafts });
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
    const body = await request.json();
    const id = typeof body.id === 'string' ? body.id : null;
    const action = body.action === 'publish' || body.action === 'archive' ? body.action : null;
    if (!id || !action) {
      return NextResponse.json({ error: 'Mangler id eller handling' }, { status: 400 });
    }

    const pollId = action === 'publish' ? await publishPoll(id) : await archivePoll(id);
    return NextResponse.json({ ok: true, id: pollId, action });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.toLowerCase().includes('not a draft') || message.toLowerCase().includes('cannot be archived')) {
      return NextResponse.json({ error: 'Utkastet kan ikke oppdateres' }, { status: 409 });
    }
    if (message.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: 'Avstemning ikke funnet' }, { status: 404 });
    }
    console.error('Admin poll patch failed', error);
    return NextResponse.json({ error: 'Kunne ikke oppdatere utkast' }, { status: 500 });
  }
}
