import { NextResponse } from 'next/server';
import { reorderAppRoadmapItems } from '@/lib/admin/app-future';
import { requireAdmin } from '@/lib/admin/gate';

export const dynamic = 'force-dynamic';

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
    const orderedIds = Array.isArray(payload.orderedIds)
      ? payload.orderedIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      : [];
    if (orderedIds.length === 0) {
      return NextResponse.json({ error: 'Mangler rekkefølge' }, { status: 400 });
    }
    await reorderAppRoadmapItems(orderedIds);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin/roadmap/reorder] failed', error);
    return NextResponse.json({ error: 'Kunne ikke oppdatere rekkefølgen.' }, { status: 500 });
  }
}
