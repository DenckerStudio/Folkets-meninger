import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import {
  listAppSuggestions,
  setAppSuggestionStatus,
  setAppSuggestionVoting,
} from '@/lib/admin/suggestions';
import { isSuggestionStatus } from '@/lib/appens-fremtid/constants';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const statusRaw = searchParams.get('status');
  const status = isSuggestionStatus(statusRaw) ? statusRaw : null;

  try {
    const suggestions = await listAppSuggestions(status);
    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('[admin/suggestions] list failed', error);
    return NextResponse.json({ error: 'Kunne ikke laste forslag.' }, { status: 500 });
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
      return NextResponse.json({ error: 'Mangler forslag' }, { status: 400 });
    }

    if (typeof body.votingOpen === 'boolean') {
      await setAppSuggestionVoting(id, auth.userId, body.votingOpen);
      return NextResponse.json({ ok: true, id, votingOpen: body.votingOpen });
    }

    if (!isSuggestionStatus(body.status)) {
      return NextResponse.json({ error: 'Mangler forslag eller status' }, { status: 400 });
    }

    await setAppSuggestionStatus(id, auth.userId, body.status);
    return NextResponse.json({ ok: true, id, status: body.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: 'Forslaget ble ikke funnet' }, { status: 404 });
    }
    if (message.toLowerCase().includes('admin required')) {
      return NextResponse.json({ error: 'Ingen tilgang' }, { status: 403 });
    }
    console.error('[admin/suggestions] update failed', error);
    return NextResponse.json({ error: 'Kunne ikke oppdatere forslaget' }, { status: 500 });
  }
}
