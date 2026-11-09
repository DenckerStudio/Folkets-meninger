import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import {
  buildResearchTopicBlogDraftInput,
  lookupResearchTopicBlogDraft,
  researchTopicBlogBlockingMessage,
  researchTopicBlogCanCreate,
} from '@/lib/admin/research/topic-blog-draft';
import { getResearchTopicById } from '@/lib/admin/research/topic-service';
import { parseClientResearchRequestId } from '@/lib/admin/research/request-id';
import { createBlogDraft } from '@/lib/blog/service';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ topicId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { topicId } = await context.params;
  const topic = await getResearchTopicById(topicId?.trim() ?? '');
  if (!topic) {
    return NextResponse.json({ error: 'not_found', message: 'Fant ikke tema' }, { status: 404 });
  }

  const canCreate = researchTopicBlogCanCreate(topic);
  const existing = canCreate ? await lookupResearchTopicBlogDraft(topic.request_id) : { found: false as const };

  return NextResponse.json({
    topic_id: topic.id,
    status: topic.status,
    publishable: topic.publishable,
    can_create: canCreate,
    blocking_message: canCreate ? null : researchTopicBlogBlockingMessage(topic),
    request_id: topic.request_id,
    existing_draft:
      existing && existing.found
        ? {
            id: existing.id,
            slug: existing.slug,
            admin_url: existing.adminUrl,
            cms_status: existing.cmsStatus,
          }
        : null,
    cms_lookup_failed: existing === null,
  });
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { topicId } = await context.params;
  const topic = await getResearchTopicById(topicId?.trim() ?? '');
  if (!topic) {
    return NextResponse.json({ error: 'not_found', message: 'Fant ikke tema' }, { status: 404 });
  }

  if (!researchTopicBlogCanCreate(topic)) {
    return NextResponse.json(
      {
        error: 'not_publishable',
        message: researchTopicBlogBlockingMessage(topic),
      },
      { status: 409 },
    );
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const forceNew = record.force_new === true;
  const variantRaw =
    typeof record.variant_id === 'string' ? record.variant_id.trim() : '';
  const variantId = forceNew ? parseClientResearchRequestId({ request_id: variantRaw }) : null;

  if (forceNew && !variantId) {
    return NextResponse.json(
      { error: 'invalid_variant', message: 'variant_id må være en gyldig UUID ved nytt utkast' },
      { status: 400 },
    );
  }

  const existing = await lookupResearchTopicBlogDraft(topic.request_id);
  if (existing === null) {
    return NextResponse.json(
      { error: 'cms_unavailable', message: 'CMS-oppslag feilet — prøv igjen senere' },
      { status: 503 },
    );
  }

  if (existing.found && !forceNew) {
    return NextResponse.json({
      ok: true,
      created: false,
      id: existing.id,
      slug: existing.slug,
      admin_url: existing.adminUrl,
      cms_status: existing.cmsStatus,
      needs_confirm_for_new: true,
    });
  }

  const built = buildResearchTopicBlogDraftInput({
    topicId: topic.id,
    requestId: topic.request_id,
    output: topic.output,
    rawTopicTitle: topic.title,
    variantId,
  });

  if (!built.ok) {
    return NextResponse.json({ error: built.code, message: built.error }, { status: 400 });
  }

  const result = await createBlogDraft(built.input);
  if (!result.ok) {
    return NextResponse.json(
      {
        error: 'cms_error',
        message: result.error,
        id: result.id,
        slug: result.slug,
        admin_url: result.adminUrl,
        cms_status: result.cmsStatus,
      },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    created: result.created,
    id: result.id,
    slug: result.slug,
    admin_url: result.adminUrl,
    cms_status: result.cmsStatus,
    needs_confirm_for_new: false,
  });
}
