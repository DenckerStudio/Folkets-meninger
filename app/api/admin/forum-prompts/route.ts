import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireForumAdmin } from '@/lib/forum/admin';
import {
  isActivePromptUniqueViolation,
  validatePromptSourceHeadlines,
  validatePromptVoteOptions,
} from '@/lib/forum/admin-prompt-validation';
import { DEFAULT_REEL_VOTE_OPTIONS } from '@/lib/forum/prompt-vote-options';

export const dynamic = 'force-dynamic';

const PROMPT_STATUSES = ['draft', 'active', 'archived'] as const;
type PromptStatus = (typeof PROMPT_STATUSES)[number];

function parseStatus(value: string | null): PromptStatus | null {
  if (!value) return 'draft';
  return PROMPT_STATUSES.includes(value as PromptStatus) ? (value as PromptStatus) : null;
}

function mapPromptWriteError(error: { code?: string; message?: string } | null) {
  if (isActivePromptUniqueViolation(error)) {
    return NextResponse.json(
      {
        error:
          'Det finnes allerede en aktiv reel med dette spørsmålet. Arkiver den eksisterende eller endre formuleringen.',
      },
      { status: 409 },
    );
  }
  return null;
}

export async function GET(request: Request) {
  const auth = await requireForumAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const status = parseStatus(searchParams.get('status'));
  if (!status) {
    return NextResponse.json({ error: 'Ugyldig status' }, { status: 400 });
  }

  const service = getServiceSupabase();
  const { data, error } = await service
    .from('forum_prompts')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Kunne ikke hente prompts' }, { status: 500 });
  }

  return NextResponse.json({ prompts: data || [] });
}

export async function POST(request: Request) {
  const auth = await requireForumAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const question = String(body.question || '').trim();
  if (question.length < 12) {
    return NextResponse.json({ error: 'Spørsmål må være minst 12 tegn' }, { status: 400 });
  }

  const optionsInput =
    Array.isArray(body.options) && body.options.length
      ? body.options
      : [...DEFAULT_REEL_VOTE_OPTIONS];
  const optionsCheck = validatePromptVoteOptions(optionsInput);
  if (!optionsCheck.ok) {
    return NextResponse.json({ error: optionsCheck.error }, { status: 400 });
  }

  const sourcesCheck = validatePromptSourceHeadlines(body.source_headlines);
  if (!sourcesCheck.ok) {
    return NextResponse.json({ error: sourcesCheck.error }, { status: 400 });
  }

  const status: PromptStatus = body.status === 'active' ? 'active' : 'draft';
  const sensitivity = body.sensitivity === 'high' ? 'high' : 'low';
  const topicTags = Array.isArray(body.topic_tags)
    ? body.topic_tags.map((t: unknown) => String(t).trim()).filter(Boolean)
    : [];

  const service = getServiceSupabase();
  const { data: maxRow } = await service
    .from('forum_prompts')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const insert: Record<string, unknown> = {
    question,
    options: optionsInput,
    source_headlines: sourcesCheck.sources,
    topic_tags: topicTags,
    sensitivity,
    status,
    sort_order: (maxRow?.sort_order ?? 0) + 1,
    stortinget_issue_id: body.stortinget_issue_id || null,
  };

  if (status === 'active') {
    insert.expires_at = body.expires_at
      ? new Date(body.expires_at).toISOString()
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  } else if (body.expires_at) {
    insert.expires_at = new Date(body.expires_at).toISOString();
  }

  const { data, error } = await service.from('forum_prompts').insert(insert).select('id').single();

  if (error) {
    const conflict = mapPromptWriteError(error);
    if (conflict) return conflict;
    return NextResponse.json({ error: 'Kunne ikke opprette' }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data?.id });
}

export async function PATCH(request: Request) {
  const auth = await requireForumAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: 'Mangler id' }, { status: 400 });
  }

  const service = getServiceSupabase();
  const updates: Record<string, unknown> = {};

  if (body.status && PROMPT_STATUSES.includes(body.status)) {
    updates.status = body.status;
    if (body.status === 'active') {
      updates.expires_at = body.expires_at
        ? new Date(body.expires_at).toISOString()
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    }
  }

  if (typeof body.question === 'string' && body.question.trim().length >= 12) {
    updates.question = body.question.trim();
  } else if (typeof body.question === 'string' && body.question.trim().length > 0) {
    return NextResponse.json({ error: 'Spørsmål må være minst 12 tegn' }, { status: 400 });
  }

  if (Array.isArray(body.options)) {
    const optionsCheck = validatePromptVoteOptions(body.options);
    if (!optionsCheck.ok) {
      return NextResponse.json({ error: optionsCheck.error }, { status: 400 });
    }
    updates.options = body.options;
  }

  if (body.source_headlines !== undefined) {
    const sourcesCheck = validatePromptSourceHeadlines(body.source_headlines);
    if (!sourcesCheck.ok) {
      return NextResponse.json({ error: sourcesCheck.error }, { status: 400 });
    }
    updates.source_headlines = sourcesCheck.sources;
  }

  if (Array.isArray(body.topic_tags)) {
    updates.topic_tags = body.topic_tags.map((t: unknown) => String(t).trim()).filter(Boolean);
  }
  if (body.sensitivity === 'high' || body.sensitivity === 'low') {
    updates.sensitivity = body.sensitivity;
  }
  if (body.expires_at !== undefined) {
    updates.expires_at = body.expires_at ? new Date(body.expires_at).toISOString() : null;
  }
  if (body.stortinget_issue_id !== undefined) {
    updates.stortinget_issue_id = body.stortinget_issue_id || null;
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: 'Ingen felter å oppdatere' }, { status: 400 });
  }

  const { error } = await service.from('forum_prompts').update(updates).eq('id', id);

  if (error) {
    const conflict = mapPromptWriteError(error);
    if (conflict) return conflict;
    return NextResponse.json({ error: 'Kunne ikke oppdatere' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
