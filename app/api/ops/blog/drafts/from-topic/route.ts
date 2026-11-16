import { NextResponse } from 'next/server';
import { cronAuthResponse } from '@/lib/cron-auth';
import { verifyOpsSecret } from '@/lib/ops-auth';
import {
  createOpsBlogDraftFromTopic,
  opsTopicBlogDraftJsonBody,
  opsTopicBlogDraftResponseStatus,
  parseOpsTopicBlogDraftBody,
} from '@/lib/blog/ops-topic-blog-draft';
import {
  httpStatusForOpsTopicBlogDraftError,
  isOpsTopicBlogDraftErrorRetryable,
  OPS_TOPIC_BLOG_DRAFT_ERROR_MESSAGE,
} from '@/lib/blog/ops-topic-blog-draft-errors';

export const dynamic = 'force-dynamic';
/** Sync pipeline: kilder + LLM (maks ~110 s) innenfor ops-grensen 120 s. */
export const maxDuration = 120;

export async function POST(request: Request) {
  const auth = verifyOpsSecret(request);
  if (!auth.ok) {
    return cronAuthResponse(auth);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error_code: 'invalid_input',
        retryable: isOpsTopicBlogDraftErrorRetryable('invalid_input'),
        message: OPS_TOPIC_BLOG_DRAFT_ERROR_MESSAGE.invalid_input,
      },
      { status: httpStatusForOpsTopicBlogDraftError('invalid_input') },
    );
  }

  const parsed = parseOpsTopicBlogDraftBody(body);
  if (!parsed.ok) {
    return NextResponse.json(
      {
        ok: false,
        error_code: parsed.error_code,
        retryable: isOpsTopicBlogDraftErrorRetryable(parsed.error_code),
        message: OPS_TOPIC_BLOG_DRAFT_ERROR_MESSAGE[parsed.error_code],
      },
      { status: httpStatusForOpsTopicBlogDraftError(parsed.error_code) },
    );
  }

  try {
    const result = await createOpsBlogDraftFromTopic({ topicId: parsed.topicId });
    return NextResponse.json(opsTopicBlogDraftJsonBody(result), {
      status: opsTopicBlogDraftResponseStatus(result),
    });
  } catch (error) {
    console.error('[ops/blog/drafts/from-topic]', error);
    return NextResponse.json(
      {
        ok: false,
        error_code: 'db_error',
        retryable: true,
        message: OPS_TOPIC_BLOG_DRAFT_ERROR_MESSAGE.db_error,
      },
      { status: 500 },
    );
  }
}