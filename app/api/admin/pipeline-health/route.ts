import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import { triggerPipelineCatchup } from '@/lib/n8n/pipeline-catchup';
import { normalizePipelineHealth } from '@/lib/n8n/pipeline-health';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Serveren er ikke konfigurert' }, { status: 503 });
  }

  const service = getServiceSupabase();
  const { data, error } = await service.rpc('n8n_pipeline_health');
  if (error) {
    console.error('[pipeline-health] RPC feilet:', error);
    return NextResponse.json({ error: 'Kunne ikke hente pipeline-status' }, { status: 500 });
  }

  return NextResponse.json({ health: normalizePipelineHealth(data) });
}

export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const triggered = triggerPipelineCatchup();
  return NextResponse.json({ ok: true, triggered });
}
