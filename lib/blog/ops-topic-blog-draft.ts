import { researchTopicBlogCanCreate } from '@/lib/admin/research/topic-blog-draft-client';
import { listResearchTopicBlogDrafts } from '@/lib/admin/research/topic-blog-draft';
import { getResearchTopicByIdResult } from '@/lib/admin/research/topic-service';
import { isAnswerLlmConfigured } from '@/lib/blog/answer-llm';
import { finalizeBlogDraftBodyWithSources } from '@/lib/blog/blog-citations';
import { buildResearchTopicBlogDraftWithSources } from '@/lib/blog/create-blog-draft';
import type { BlogDraftSource } from '@/lib/blog/blog-draft-sources';
import {
  httpStatusForOpsTopicBlogDraftError,
  isOpsTopicBlogDraftErrorRetryable,
  OPS_TOPIC_BLOG_DRAFT_ERROR_MESSAGE,
  type OpsTopicBlogDraftErrorCode,
} from '@/lib/blog/ops-topic-blog-draft-errors';
import { createBlogDraft } from '@/lib/blog/service';
import type { BlogPostSourcePublic } from '@/lib/blog/types';

const TOPIC_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type OpsTopicBlogDraftSuccess = {
  ok: true;
  draft_id: string;
  source_count: number;
  created: boolean;
};

export type OpsTopicBlogDraftFailure = {
  ok: false;
  error_code: OpsTopicBlogDraftErrorCode;
  retryable: boolean;
  draft_id?: string;
};

export type OpsTopicBlogDraftResult = OpsTopicBlogDraftSuccess | OpsTopicBlogDraftFailure;

export function parseOpsTopicBlogDraftBody(
  body: unknown,
): { ok: true; topicId: string } | { ok: false; error_code: 'invalid_input' } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error_code: 'invalid_input' };
  }
  const topicRaw = (body as Record<string, unknown>).topic_id;
  const topicId = typeof topicRaw === 'string' ? topicRaw.trim() : '';
  if (!topicId || !TOPIC_ID_RE.test(topicId)) {
    return { ok: false, error_code: 'invalid_input' };
  }
  return { ok: true, topicId };
}

export function filterOpenResearchTopicBlogDrafts(
  drafts: Awaited<ReturnType<typeof listResearchTopicBlogDrafts>>['drafts'],
) {
  return drafts.filter((row) => row.cmsStatus === 'draft' || row.cmsStatus === 'unknown');
}

function blogDraftSourcesToPublic(sources: readonly BlogDraftSource[]): BlogPostSourcePublic[] {
  return sources.map((source, index) => ({
    index: index + 1,
    title: source.title,
    publisher: source.publisher,
    url: source.url,
    publishedAt: source.publishedAt,
  }));
}

function mapBuildCode(
  code:
    | 'missing_topic_title'
    | 'invalid_output'
    | 'empty_body'
    | 'invalid_slug'
    | 'llm_timeout'
    | 'llm_error'
    | 'search_error',
): OpsTopicBlogDraftErrorCode {
  if (code === 'llm_timeout') return 'llm_timeout';
  if (code === 'llm_error') return 'llm_error';
  if (code === 'search_error') return 'search_error';
  if (code === 'empty_body' || code === 'missing_topic_title') return 'insufficient_sources';
  return 'invalid_input';
}

export function opsTopicBlogDraftFailure(
  error_code: OpsTopicBlogDraftErrorCode,
  draft_id?: string,
): OpsTopicBlogDraftFailure {
  return {
    ok: false,
    error_code,
    retryable: isOpsTopicBlogDraftErrorRetryable(error_code),
    ...(draft_id ? { draft_id } : {}),
  };
}

export async function createOpsBlogDraftFromTopic(args: {
  topicId: string;
  fetchImpl?: typeof fetch;
}): Promise<OpsTopicBlogDraftResult> {
  const loaded = await getResearchTopicByIdResult(args.topicId);
  if (!loaded.ok) {
    return opsTopicBlogDraftFailure(
      loaded.reason === 'db_error' ? 'db_error' : 'topic_not_found',
    );
  }

  const topic = loaded.topic;
  if (!researchTopicBlogCanCreate(topic)) {
    return opsTopicBlogDraftFailure('insufficient_sources');
  }

  const listed = await listResearchTopicBlogDrafts(topic.request_id);
  if (listed.lookupFailed) {
    return opsTopicBlogDraftFailure('db_error');
  }

  const open = filterOpenResearchTopicBlogDrafts(listed.drafts);
  if (open.length > 0) {
    return opsTopicBlogDraftFailure('draft_exists', open[0]!.id);
  }

  const built = await buildResearchTopicBlogDraftWithSources({
    requestId: topic.request_id,
    topicId: topic.id,
    output: topic.output,
    fetchImpl: args.fetchImpl,
    llmOnFailure: 'fail',
    failOnSearchError: true,
  });

  if (!built.ok) {
    return opsTopicBlogDraftFailure(mapBuildCode(built.code));
  }

  const sourceCount = built.sourcesUsed.length;
  if (isAnswerLlmConfigured() && sourceCount === 0) {
    return opsTopicBlogDraftFailure('insufficient_sources');
  }

  const publicSources = blogDraftSourcesToPublic(built.sourcesUsed);
  const input = {
    ...built.input,
    body_md: finalizeBlogDraftBodyWithSources(built.input.body_md, [], publicSources),
  };

  const created = await createBlogDraft(input);
  if (!created.ok) {
    if (created.status >= 500) {
      return opsTopicBlogDraftFailure('db_error');
    }
    return opsTopicBlogDraftFailure('invalid_input');
  }

  return {
    ok: true,
    draft_id: created.id,
    source_count: sourceCount,
    created: created.created,
  };
}

export function opsTopicBlogDraftJsonBody(result: OpsTopicBlogDraftResult): Record<string, unknown> {
  if (result.ok) {
    return {
      ok: true,
      draft_id: result.draft_id,
      source_count: result.source_count,
    };
  }
  return {
    ok: false,
    error_code: result.error_code,
    retryable: result.retryable,
    ...(result.draft_id ? { draft_id: result.draft_id } : {}),
    message: OPS_TOPIC_BLOG_DRAFT_ERROR_MESSAGE[result.error_code],
  };
}

export function opsTopicBlogDraftResponseStatus(result: OpsTopicBlogDraftResult): number {
  if (result.ok) return 200;
  return httpStatusForOpsTopicBlogDraftError(result.error_code);
}