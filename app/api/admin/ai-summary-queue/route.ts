import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import { parseResetAiSummaryQueueBody } from '@/lib/content-feedback/ai-summary-queue-admin';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export type AiSummaryQueueGaveUpRow = {
  issue_id: string;
  title: string | null;
  kind: 'mangler_sammendrag' | 'regenerering' | 'tynt_sammendrag';
  attempts: number;
  last_attempt_at: string | null;
};

function parseGaveUpRows(raw: unknown): AiSummaryQueueGaveUpRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const item = row as Record<string, unknown>;
      const issueId = typeof item.issue_id === 'string' ? item.issue_id : null;
      const kind = item.kind;
      if (!issueId || typeof kind !== 'string') return null;
      if (kind !== 'mangler_sammendrag' && kind !== 'regenerering' && kind !== 'tynt_sammendrag') {
        return null;
      }
      return {
        issue_id: issueId,
        title: typeof item.title === 'string' ? item.title : null,
        kind,
        attempts: typeof item.attempts === 'number' ? item.attempts : Number(item.attempts) || 0,
        last_attempt_at:
          typeof item.last_attempt_at === 'string' ? item.last_attempt_at : null,
      } satisfies AiSummaryQueueGaveUpRow;
    })
    .filter((row): row is AiSummaryQueueGaveUpRow => row !== null);
}

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
    console.error('[ai-summary-queue] list feilet:', error);
    return NextResponse.json({ error: 'Kunne ikke hente køstatus' }, { status: 500 });
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
    console.error('[ai-summary-queue] reset feilet:', error);
    return NextResponse.json({ error: 'Kunne ikke nullstille forsøk' }, { status: 500 });
  }

  if (data !== true) {
    return NextResponse.json({ error: 'Saken finnes ikke' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
