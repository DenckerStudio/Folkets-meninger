import { NextResponse } from 'next/server';
import { recordBlogAutoContentFeedback } from '@/lib/content-feedback/blog-auto';
import { verifyContentFeedbackWebhook, contentFeedbackWebhookSecret } from '@/lib/content-feedback/ops-auth';
import { parseBlogContentFeedbackWebhook } from '@/lib/content-feedback/parse-ops-webhook';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!contentFeedbackWebhookSecret()) {
    return NextResponse.json({ error: 'Tjenesten er ikke tilgjengelig' }, { status: 503 });
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
    console.error('[content-feedback] log_blog_content_feedback failed', {
      post_id: parsed.payload.post_id,
      event: parsed.payload.event,
      message: result.error,
    });
    return NextResponse.json({ error: 'Kunne ikke lagre tilbakemelding' }, { status: 500 });
  }

  console.info('[content-feedback] log_blog_content_feedback', {
    post_id: parsed.payload.post_id,
    event: parsed.payload.event,
    event_id: parsed.payload.event_id,
    rpc_status: result.rpc.status,
    content_feedback_id: result.rpc.id,
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
