import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import { triggerSystemPollDraftWebhook } from '@/lib/trigger-system-poll-draft-webhook';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let issueId: string | undefined;
  try {
    const body = await request.json();
    if (typeof body.stortinget_issue_id === 'string' && body.stortinget_issue_id.trim()) {
      issueId = body.stortinget_issue_id.trim();
    }
  } catch {
    issueId = undefined;
  }

  const queued = triggerSystemPollDraftWebhook(issueId);
  if (!queued) {
    return NextResponse.json(
      { error: 'Generering er ikke konfigurert (mangler N8N_SYSTEM_POLL_DRAFT_WEBHOOK_URL)' },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, queued: true, stortinget_issue_id: issueId ?? null });
}
