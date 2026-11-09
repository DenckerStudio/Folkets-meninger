import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/gate';
import {
  researchTopicSakPollBlockingMessage,
  researchTopicSakPollCanCreate,
  validateResearchTopicSakPollIngress,
} from '@/lib/admin/research/topic-sak-poll-client';
import {
  buildResearchTopicPublicTitle,
  lookupResearchTopicSakPoll,
  publishResearchTopicSakPoll,
} from '@/lib/admin/research/topic-sak-poll';
import { getResearchTopicById } from '@/lib/admin/research/topic-service';
import {
  validatePublishStortingetPollInput,
  type ClosesAtApplyAction,
} from '@/lib/polls/stortinget-poll-admin';
import { routes } from '@/lib/routes';

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

  const canCreate = researchTopicSakPollCanCreate(topic);
  if (!canCreate) {
    return NextResponse.json({
      topic_id: topic.id,
      can_create: false,
      blocking_message: researchTopicSakPollBlockingMessage(topic),
    });
  }

  const publicTitle = buildResearchTopicPublicTitle(topic.output);
  if (!publicTitle) {
    return NextResponse.json({
      topic_id: topic.id,
      can_create: false,
      blocking_message: 'Briefen mangler tittel – kjør briefen på nytt.',
    });
  }

  const lookup = await lookupResearchTopicSakPoll(topic);

  return NextResponse.json({
    topic_id: topic.id,
    can_create: true,
    blocking_message: null,
    issue_id: lookup.issueId,
    poll_id: lookup.pollId,
    poll_status: lookup.pollStatus,
    suggested_issue_id: lookup.suggestedIssueId,
    default_title: lookup.defaultTitle,
    default_neutral_summary: lookup.defaultNeutralSummary,
    default_neutral_summary_truncated: lookup.defaultNeutralSummaryTruncated,
    default_neutral_summary_has_content: lookup.defaultNeutralSummaryHasContent,
    source_urls: lookup.sourceUrls,
    stortinget_page_url: lookup.stortingetPageUrl,
    title_over_limit: lookup.titleOverLimit,
    dedicated_sak: lookup.dedicatedSak,
    missing_topic_title: false,
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

  if (!researchTopicSakPollCanCreate(topic)) {
    return NextResponse.json(
      {
        message: researchTopicSakPollBlockingMessage(topic),
      },
      { status: 400 },
    );
  }

  if (!buildResearchTopicPublicTitle(topic.output)) {
    return NextResponse.json(
      { message: 'Briefen mangler tittel – kjør briefen på nytt.' },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const forceNew = body.force_new === true;

  const lookup = await lookupResearchTopicSakPoll(topic);
  const issueId =
    typeof body.issue_id === 'string' && body.issue_id.trim()
      ? body.issue_id.trim()
      : lookup.suggestedIssueId;

  const validated = validatePublishStortingetPollInput({
    issueId,
    title: typeof body.title === 'string' ? body.title : lookup.defaultTitle ?? '',
    neutralSummary:
      typeof body.neutral_summary === 'string'
        ? body.neutral_summary
        : lookup.defaultNeutralSummary,
    isUpdate: false,
    initialClosesAtWire:
      typeof body.initial_closes_at_wire === 'string' ? body.initial_closes_at_wire : null,
    closesAtDate: typeof body.closes_at_date === 'string' ? body.closes_at_date : '',
    closesAtTime: typeof body.closes_at_time === 'string' ? body.closes_at_time : '',
  });

  if (!validated.ok) {
    return NextResponse.json({ message: validated.error }, { status: 400 });
  }

  const ingressError = validateResearchTopicSakPollIngress(validated.value.neutralSummary);
  if (ingressError) {
    return NextResponse.json({ message: ingressError }, { status: 400 });
  }

  const sourceUrls =
    Array.isArray(body.source_urls) && body.source_urls.length > 0
      ? (body.source_urls as { label?: string; url: string }[])
      : lookup.sourceUrls;

  const publishResult = await publishResearchTopicSakPoll({
    topicId: topic.id,
    issueId: validated.value.issueId,
    title: validated.value.title,
    neutralSummary: validated.value.neutralSummary,
    sourceUrls,
    closesAt: validated.value.closesAt as ClosesAtApplyAction,
    forceNew,
    existingPollId: lookup.pollId,
  });

  if (!publishResult.ok) {
    const status = publishResult.error.includes('Bekreft') ? 409 : 400;
    return NextResponse.json(
      {
        message: publishResult.error,
        needs_confirm_for_new: status === 409,
      },
      { status },
    );
  }

  revalidatePath(routes.avstemninger);
  revalidatePath(routes.poll(publishResult.pollId));
  revalidatePath(routes.sak(publishResult.issueId));
  revalidatePath(routes.adminResearchTopic(topic.id));

  return NextResponse.json({
    ok: true,
    issue_id: publishResult.issueId,
    poll_id: publishResult.pollId,
    sak_url: routes.sak(publishResult.issueId),
    poll_url: routes.poll(publishResult.pollId),
  });
}
