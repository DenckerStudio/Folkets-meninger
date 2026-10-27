import { NextResponse } from 'next/server';
import { adminLoadErrorJson, logPostgrestError } from '@/lib/admin/postgrest-error';
import { requireAdmin } from '@/lib/admin/gate';
import { parseResetAiSummaryQueueBody } from '@/lib/content-feedback/ai-summary-queue-admin';
import { parseGaveUpRows } from '@/lib/content-feedback/ai-summary-queue-parse';
import type { AiSummaryQueueGaveUpRow } from '@/lib/content-feedback/ai-summary-queue-types';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export type { AiSummaryQueueGaveUpRow };

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Serveren er ikke konfigurert' }, { status: 503 });
  }

  const service = getServiceSupabase();
  const { data, error } = await service.rpc('admin_list_ai_summary_queue_gave_up', {
    p_admin_user_id: auth.userId,
    p_limit: 50,
  });
  if (error) {
    logPostgrestError('[ai-summary-queue] list feilet', error);
    return NextResponse.json(
      adminLoadErrorJson('Kunne ikke hente køstatus', error),
      { status: 500 },
    );
  }

  const rows = parseGaveUpRows(data);
  return NextResponse.json({ gaveUp: rows, gaveUpCount: rows.length });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Serveren er ikke konfigurert' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ugyldig JSON' }, { status: 400 });
  }

  const parsed = parseResetAiSummaryQueueBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const service = getServiceSupabase();
  const { data, error } = await service.rpc('admin_reset_ai_summary_queue_attempts', {
    p_admin_user_id: auth.userId,
    p_issue_id: parsed.issueId,
  });
  if (error) {
    logPostgrestError('[ai-summary-queue] reset feilet', error);
    return NextResponse.json(
      adminLoadErrorJson('Kunne ikke nullstille forsøk', error),
      { status: 500 },
    );
  }

  if (data !== true) {
    return NextResponse.json({ error: 'Saken finnes ikke' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
