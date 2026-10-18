import { NextResponse } from 'next/server';
import {
  createAppChangelogEntry,
  deleteAppChangelogEntry,
  listAppChangelogEntries,
} from '@/lib/admin/app-future';
import { requireAdmin } from '@/lib/admin/gate';
import { validateChangelogInput } from '@/lib/appens-fremtid/validate';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const entries = await listAppChangelogEntries();
    return NextResponse.json({ entries });
  } catch (error) {
    console.error('[admin/changelog] list failed', error);
    return NextResponse.json({ error: 'Kunne ikke laste endringsloggen.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Serveren er ikke konfigurert' }, { status: 503 });
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const parsed = validateChangelogInput(payload);
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const id = await createAppChangelogEntry(auth.userId, parsed.title, parsed.body);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error('[admin/changelog] create failed', error);
    return NextResponse.json({ error: 'Kunne ikke publisere innlegget.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Serveren er ikke konfigurert' }, { status: 503 });
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const id = typeof payload.id === 'string' ? payload.id.trim() : '';
    if (!id) {
      return NextResponse.json({ error: 'Mangler innlegg' }, { status: 400 });
    }
    await deleteAppChangelogEntry(auth.userId, id);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: 'Innlegget ble ikke funnet' }, { status: 404 });
    }
    console.error('[admin/changelog] delete failed', error);
    return NextResponse.json({ error: 'Kunne ikke slette innlegget.' }, { status: 500 });
  }
}
