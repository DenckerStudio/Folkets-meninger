import { NextResponse } from 'next/server';
import { isAiFeedbackReasonCode } from '@/lib/ai/reason-codes';
import { recordSummaryRegenerateFeedback } from '@/lib/ai/record-summary-feedback';
import {
  deleteAiSummary,
  getAiSummaryRowForFeedback,
  resolveAiSummaryForApi,
} from '@/lib/ai-summary/service';
import { requireAdmin } from '@/lib/admin/gate';
import { triggerAiSummaryWebhook } from '@/lib/trigger-ai-summary-webhook';
import { isAiSummaryV2 } from '@/lib/ai-summary/types';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Mangler saks-ID' }, { status: 400 });
  }

  const result = await resolveAiSummaryForApi(id, { triggerIfMissing: true });

  if (result.status === 'ready') {
    if (isAiSummaryV2(result)) {
      return NextResponse.json({
        version: 2,
        narrative: result.narrative,
        who_affected: result.who_affected,
        how_affected: result.how_affected,
        topic_cards: result.topic_cards,
        labels: result.labels,
        cached: result.cached,
      });
    }

    return NextResponse.json({
      version: 1,
      hva: result.hva,
      hvem: result.hvem,
      kostnad: result.kostnad,
      cached: result.cached,
    });
  }

  return NextResponse.json(
    {
      status: 'pending',
      retry_after_seconds: result.retry_after_seconds,
    },
    { status: 202 }
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const force = body?.force === true;

  if (!id) {
    return NextResponse.json({ error: 'Mangler saks-ID' }, { status: 400 });
  }

  if (!force) {
    return GET(request, { params });
  }

  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const reasonCode = typeof body?.reasonCode === 'string' ? body.reasonCode : null;
  const reasonNote = typeof body?.reasonNote === 'string' ? body.reasonNote : null;
  if (!reasonCode || !isAiFeedbackReasonCode(reasonCode)) {
    return NextResponse.json({ error: 'Grunnkode er påkrevd ved regenerering' }, { status: 400 });
  }
  if (reasonNote && reasonNote.length > 300) {
    return NextResponse.json({ error: 'Notatet er for langt' }, { status: 400 });
  }

  const beforeRow = await getAiSummaryRowForFeedback(id);
  if (beforeRow) {
    await recordSummaryRegenerateFeedback({
      issueId: id,
      reasonCode,
      reasonNote,
      decidedBy: admin.userId,
      beforeJson: beforeRow,
    });
  }

  await deleteAiSummary(id);
  triggerAiSummaryWebhook(id);

  return NextResponse.json(
    {
      status: 'pending',
      retry_after_seconds: 15,
      regenerated: true,
    },
    { status: 202 }
  );
}
