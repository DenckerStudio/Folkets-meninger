import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import { isResearchApiAction } from '@/lib/admin/research/actions';
import { enqueueResearchJob } from '@/lib/admin/research/service';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ clusterId: string; action: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { clusterId, action } = await context.params;
  if (!clusterId?.trim() || !isResearchApiAction(action)) {
    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 });
  }

  const result = await enqueueResearchJob(clusterId.trim(), action, auth.userId);
  if (!result.ok) {
    if (result.code === 'not_found') {
      return NextResponse.json({ error: 'Klyngen finnes ikke' }, { status: 404 });
    }
    if (result.code === 'not_configured') {
      return NextResponse.json(
        { error: 'Research-webhook er ikke konfigurert' },
        { status: 503 },
      );
    }
    if (result.code === 'webhook_failed') {
      return NextResponse.json(
        { error: 'Kunne ikke nå research-webhook' },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: 'Kunne ikke opprette research-oppgave' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, request_id: result.requestId, status: 'queued' });
}
