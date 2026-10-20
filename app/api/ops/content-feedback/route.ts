import { NextResponse } from 'next/server';
import { recordBlogAutoContentFeedback } from '@/lib/content-feedback/blog-auto';
import { verifyContentFeedbackWebhook, contentFeedbackWebhookSecret } from '@/lib/content-feedback/ops-auth';
import { parseBlogContentFeedbackWebhook } from '@/lib/content-feedback/parse-ops-webhook';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secret = contentFeedbackWebhookSecret();
  if (!secret) {
    return NextResponse.json(
      { error: 'CMS_CONTENT_FEEDBACK_WEBHOOK_SECRET er ikke konfigurert' },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  if (!verifyContentFeedbackWebhook(request, rawBody)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: 'Ugyldig JSON' }, { status: 400 });
  }

  const parsed = parseBlogContentFeedbackWebhook(json);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await recordBlogAutoContentFeedback(parsed.payload);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    id: result.id,
    duplicate: result.duplicate,
    applied: result.applied,
  });
}
