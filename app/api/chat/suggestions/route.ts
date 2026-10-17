import { NextResponse } from 'next/server';
import { buildChatSuggestions, type ChatRecentStance, type ChatSuggestionContext, type ChatUserSignals } from '@/lib/chat/suggestions';
import { resolveChatView } from '@/lib/chat/view-context';
import { getCitizenOpinion } from '@/lib/opinions/service';
import { getPollById } from '@/lib/polls/service';
import { checkRateLimit } from '@/lib/rate-limit';
import { getServiceSupabase } from '@/lib/supabase';
import { getServerSupabase } from '@/lib/supabase-server';
import { getUserStanceHistory, getUserStanceSignals } from '@/lib/stances/service';
import { requireStemmePlus } from '@/lib/stemme-plus/entitlement';
import { fetchStortingetHoringById, getHoringTitle } from '@/lib/stortinget-horinger';
import { getPolitikereOversikt } from '@/lib/stortinget';

export const dynamic = 'force-dynamic';

const RECENT_STANCE_LIMIT = 5;
const OWN_OPINION_LIMIT = 5;

function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

async function sakTitle(issueId: string | null): Promise<string | null> {
  if (!issueId) return null;
  try {
    const service = getServiceSupabase();
    const { data } = await service
      .from('stortinget_issues')
      .select('title')
      .eq('id', issueId)
      .maybeSingle();
    return typeof data?.title === 'string' && data.title.trim() ? data.title.trim() : null;
  } catch {
    return null;
  }
}

/** Hearing title and first linked sak, so hearing prompts can use sak tools. */
async function hearingContext(id: string): Promise<{ title: string | null; issueId: string | null }> {
  try {
    const hearing = await fetchStortingetHoringById(id);
    if (!hearing) return { title: null, issueId: null };
    const sakId = hearing.horing_sak_info_liste?.find((sak) => sak.sak_id != null)?.sak_id;
    return {
      title: getHoringTitle(hearing).trim() || null,
      issueId: sakId != null ? String(sakId) : null,
    };
  } catch {
    return { title: null, issueId: null };
  }
}

async function politikerName(id: string | null): Promise<string | null> {
  if (!id) return null;
  try {
    const reps = await getPolitikereOversikt();
    const rep = reps.find((r) => String(r.id) === String(id));
    if (!rep) return null;
    const name = `${rep.fornavn ?? ''} ${rep.etternavn ?? ''}`.trim();
    return name || null;
  } catch {
    return null;
  }
}

async function loadStanceSignals(
  userId: string,
): Promise<Pick<ChatUserSignals, 'categories' | 'labels'>> {
  try {
    const service = getServiceSupabase();
    return await getUserStanceSignals(service, userId);
  } catch {
    return { categories: [], labels: [] };
  }
}

async function loadRecentStances(userId: string): Promise<ChatRecentStance[]> {
  try {
    const service = getServiceSupabase();
    const history = await getUserStanceHistory(service, userId);
    return history
      .slice(0, RECENT_STANCE_LIMIT)
      .map((item) => ({
        issueId: item.stortinget_issue_id,
        title: item.title ?? null,
        stance: item.stance,
      }));
  } catch {
    return [];
  }
}

async function loadOwnOpinions(userId: string): Promise<string[]> {
  try {
    const service = getServiceSupabase();
    const { data } = await service
      .from('citizen_opinions')
      .select('title')
      .eq('author_user_id', userId)
      .eq('is_removed', false)
      .order('created_at', { ascending: false })
      .limit(OWN_OPINION_LIMIT);
    return (data ?? [])
      .map((row) => (typeof row.title === 'string' ? row.title : ''))
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function loadInterests(userId: string): Promise<string[]> {
  try {
    const session = await getServerSupabase();
    const { data } = await session
      .from('notification_category_subscriptions')
      .select('category')
      .eq('user_id', userId)
      .order('category', { ascending: true })
      .limit(6);
    return (data ?? [])
      .map((row) => (typeof row.category === 'string' ? row.category.trim() : ''))
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function collectSignals(userId: string): Promise<ChatUserSignals> {
  try {
    const [signals, recentStances, ownOpinionTitles, interests] = await Promise.all([
      loadStanceSignals(userId),
      loadRecentStances(userId),
      loadOwnOpinions(userId),
      loadInterests(userId),
    ]);
    return {
      categories: signals.categories,
      labels: signals.labels,
      recentStances,
      interests,
      ownOpinionTitles,
    };
  } catch (error) {
    console.error('[chat/suggestions] signal error', error);
    return {
      categories: [],
      labels: [],
      recentStances: [],
      interests: [],
      ownOpinionTitles: [],
    };
  }
}

export async function GET(request: Request) {
  const gate = await requireStemmePlus();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const ipRate = checkRateLimit(`chat-suggestions:ip:${clientIp(request)}`, 60, 60_000);
  if (!ipRate.ok) {
    return NextResponse.json(
      { error: 'For mange forespørsler. Prøv igjen om litt.' },
      { status: 429, headers: { 'Retry-After': String(ipRate.retryAfterSeconds) } },
    );
  }

  const { searchParams } = new URL(request.url);
  const pathname = searchParams.get('pathname') ?? '';
  const providedIssueId = searchParams.get('issueId')?.trim() || null;
  const view = resolveChatView(pathname);

  let title: string | null = null;
  let issueId: string | null = providedIssueId;

  if (view.kind === 'sak') {
    issueId = issueId ?? view.id;
    title = await sakTitle(issueId);
  } else if (view.kind === 'mening' && view.id) {
    const opinion = await getCitizenOpinion(view.id);
    title = opinion?.title ?? null;
    issueId = issueId ?? opinion?.stortingetIssueId ?? null;
  } else if (view.kind === 'reel' && view.id) {
    const poll = await getPollById(view.id);
    title = poll?.title ?? null;
    issueId = issueId ?? poll?.stortingetIssueId ?? null;
  } else if (view.kind === 'politiker') {
    title = await politikerName(view.id);
  } else if (view.kind === 'horing' && view.id) {
    const hearing = await hearingContext(view.id);
    title = hearing.title;
    issueId = issueId ?? hearing.issueId;
  }

  const context: ChatSuggestionContext = {
    kind: view.kind,
    title,
    issueId,
    entityId: view.id,
  };

  const signals = await collectSignals(gate.userId);
  const suggestions = buildChatSuggestions({ context, signals });

  return NextResponse.json({ suggestions, context });
}
