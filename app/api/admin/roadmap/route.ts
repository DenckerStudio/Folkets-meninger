import { NextResponse } from 'next/server';
import {
  createAppRoadmapItem,
  deleteAppRoadmapItem,
  listAppRoadmapItems,
  updateAppRoadmapItem,
} from '@/lib/admin/app-future';
import { requireAdmin } from '@/lib/admin/gate';
import { validateRoadmapInput, validateRoadmapPatch } from '@/lib/appens-fremtid/validate';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const items = await listAppRoadmapItems();
    return NextResponse.json({ items });
  } catch (error) {
    console.error('[admin/roadmap] list failed', error);
    return NextResponse.json({ error: 'Kunne ikke laste veikartet.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const parsed = validateRoadmapInput(payload);
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const id = await createAppRoadmapItem(
      auth.userId,
      parsed.title,
      parsed.body,
      parsed.status,
      parsed.sortOrder,
    );
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error('[admin/roadmap] create failed', error);
    return NextResponse.json({ error: 'Kunne ikke publisere veikartpunktet.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const parsed = validateRoadmapPatch(payload);
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    await updateAppRoadmapItem(parsed.id, {
      title: parsed.title,
      body: parsed.body,
      status: parsed.status,
      sortOrder: parsed.sortOrder,
    });
    return NextResponse.json({ ok: true, id: parsed.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: 'Punktet ble ikke funnet' }, { status: 404 });
    }
    console.error('[admin/roadmap] update failed', error);
    return NextResponse.json({ error: 'Kunne ikke oppdatere veikartpunktet.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const id = typeof payload.id === 'string' ? payload.id.trim() : '';
    if (!id) {
      return NextResponse.json({ error: 'Mangler punkt' }, { status: 400 });
    }
    await deleteAppRoadmapItem(auth.userId, id);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: 'Punktet ble ikke funnet' }, { status: 404 });
    }
    console.error('[admin/roadmap] delete failed', error);
    return NextResponse.json({ error: 'Kunne ikke slette veikartpunktet.' }, { status: 500 });
  }
}
