import { NextResponse } from 'next/server';
import { requireForumAdmin } from '@/lib/forum/admin';
import { triggerForumSakPromptWebhook } from '@/lib/trigger-forum-sak-prompt-webhook';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await requireForumAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = process.env.N8N_FORUM_SAK_PROMPTS_WEBHOOK_URL?.trim();
  if (!url) {
    return NextResponse.json(
      { error: 'N8N_FORUM_SAK_PROMPTS_WEBHOOK_URL er ikke konfigurert' },
      { status: 503 },
    );
  }

  let body: { stortinget_issue_id?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const issueId = String(body.stortinget_issue_id ?? '').trim() || undefined;
  triggerForumSakPromptWebhook(issueId);

  return NextResponse.json({
    success: true,
    queued: true,
    stortinget_issue_id: issueId ?? null,
    message: issueId
      ? `Sak-prompt generering startet for ${issueId}`
      : 'Sak-prompt generering startet for neste kandidat',
  });
}
