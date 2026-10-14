import { resolvePublicAuthor } from '@/lib/identity/public-identity';
import { addStanceCount, emptyStanceCounts } from '@/lib/opinions/labels';
import {
  OPINION_BODY_MAX,
  OPINION_BODY_MIN,
  OPINION_LIST_PAGE_SIZE,
  OPINION_REPLY_BODY_MIN,
  OPINION_TITLE_MAX,
  OPINION_TITLE_MIN,
  type IssueOpinionHighlights,
  type OpinionCreateStance,
  type OpinionDetail,
  type OpinionListItem,
  type OpinionReplyItem,
  type OpinionStance,
  type OpinionStanceCounts,
  type SakPickerOption,
} from '@/lib/opinions/types';
import {
  hasOpinionFieldErrors,
  isOpinionCreateStance,
  isOpinionStance,
  parseOpinionPoints,
  requiresOpinionBody,
  validateOpinionDraft,
  validateOpinionPoints,
  validateReplyDraft,
} from '@/lib/opinions/validate';
import { resolveSakListStatus } from '@/lib/sak-status';
import { getSakerFromMemoryCache, getSakerWithCache } from '@/lib/stortinget-saker-cache';
import { getAnonSupabase, getServiceSupabase } from '@/lib/supabase';

type UserJoin = {
  first_name: string | null;
  last_name: string | null;
  name: string | null;
};

type OpinionRow = {
  id: string;
  title: string;
  body: string;
  stance: string;
  points: unknown;
  stortinget_issue_id: string | null;
  created_at: string;
  author_user_id: string;
  users: UserJoin | UserJoin[] | null;
};

type ReplyRow = {
  id: string;
  opinion_id: string;
  stance: string;
  body: string;
  created_at: string;
  updated_at: string;
  author_user_id: string;
  users: UserJoin | UserJoin[] | null;
};

function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function mapAuthor(userId: string, users: UserJoin | UserJoin[] | null): { name: string | null; initials: string } {
  const author = resolvePublicAuthor({ userId, users });
  return {
    name: author?.name ?? null,
    initials: author?.initials ?? '?',
  };
}

function mapOpinionRow(
  row: OpinionRow,
  issueTitle: string | null,
  counts: OpinionStanceCounts,
  pollId: string | null,
  viewerStance: OpinionCreateStance | 'blank' | null = null,
): OpinionListItem {
  const author = mapAuthor(row.author_user_id, row.users);
  const stance: OpinionStance = isOpinionStance(row.stance) ? row.stance : 'blank';
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    stance,
    points: parseOpinionPoints(row.points),
    stortingetIssueId: row.stortinget_issue_id,
    issueTitle,
    pollId,
    createdAt: row.created_at,
    authorUserId: row.author_user_id,
    authorName: author.name,
    authorInitials: author.initials,
    counts,
    viewerStance,
  };
}

function mapReplyRow(row: ReplyRow): OpinionReplyItem | null {
  if (!isOpinionStance(row.stance)) return null;
  const author = mapAuthor(row.author_user_id, row.users);
  return {
    id: row.id,
    opinionId: row.opinion_id,
    stance: row.stance,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    authorUserId: row.author_user_id,
    authorName: author.name,
    authorInitials: author.initials,
  };
}

async function loadIssueTitles(issueIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(issueIds.filter(Boolean))];
  const titles = new Map<string, string>();
  if (unique.length === 0 || !supabaseConfigured()) return titles;

  const supabase = getAnonSupabase();
  const { data, error } = await supabase.from('stortinget_issues').select('id, title').in('id', unique);
  if (error) {
    console.error('loadIssueTitles error:', error.message);
    return titles;
  }
  for (const row of data ?? []) {
    if (row.id && row.title) titles.set(String(row.id), String(row.title));
  }
  return titles;
}

async function loadPollIdByIssue(issueIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(issueIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0 || !supabaseConfigured()) return map;

  // Only link to a poll that is actually reachable in the Reels feed: a system
  // Reel that is still open for voting (B4/3a). A closed, draft, or non-system
  // poll has no vote face on Utforsk, so the chip must not point at it.
  const supabase = getAnonSupabase();
  const { data, error } = await supabase
    .from('polls')
    .select('id, stortinget_issue_id, created_at')
    .in('stortinget_issue_id', unique)
    .eq('track', 'system')
    .eq('status', 'open')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('loadPollIdByIssue error:', error.message);
    return map;
  }

  for (const row of data ?? []) {
    const issueId = row.stortinget_issue_id ? String(row.stortinget_issue_id) : null;
    if (!issueId || map.has(issueId)) continue;
    map.set(issueId, String(row.id));
  }
  return map;
}

async function loadCountsByOpinion(opinionIds: string[]): Promise<Map<string, OpinionStanceCounts>> {
  const map = new Map<string, OpinionStanceCounts>();
  for (const id of opinionIds) {
    map.set(id, emptyStanceCounts());
  }
  if (opinionIds.length === 0 || !supabaseConfigured()) return map;

  const supabase = getAnonSupabase();
  const { data, error } = await supabase
    .from('citizen_opinion_replies')
    .select('opinion_id, stance')
    .in('opinion_id', opinionIds)
    .eq('is_removed', false);

  if (error) {
    console.error('loadCountsByOpinion error:', error.message);
    return map;
  }

  for (const row of data ?? []) {
    const id = String(row.opinion_id);
    const stance = row.stance;
    if (!isOpinionStance(stance)) continue;
    const counts = map.get(id) ?? emptyStanceCounts();
    addStanceCount(counts, stance);
    map.set(id, counts);
  }
  return map;
}

async function loadViewerStances(
  opinionIds: string[],
  viewerUserId: string | null,
): Promise<Map<string, OpinionCreateStance | 'blank' | null>> {
  const map = new Map<string, OpinionCreateStance | 'blank' | null>();
  for (const id of opinionIds) {
    map.set(id, null);
  }
  if (opinionIds.length === 0 || !viewerUserId || !supabaseConfigured()) return map;

  const supabase = getAnonSupabase();
  const { data, error } = await supabase
    .from('citizen_opinion_replies')
    .select('opinion_id, stance, body')
    .in('opinion_id', opinionIds)
    .eq('author_user_id', viewerUserId)
    .eq('is_removed', false);

  if (error) {
    console.error('loadViewerStances error:', error.message);
    return map;
  }

  for (const row of data ?? []) {
    const id = String(row.opinion_id);
    const stance = row.stance;
    if (!isOpinionStance(stance)) continue;
    // Only consider quick stances (empty body) or blank as viewer stance for Reels
    const body = row.body ?? '';
    const isQuick = body.trim() === '' && (stance === 'for' || stance === 'imot');
    if (isQuick || stance === 'blank') {
      map.set(id, stance as OpinionCreateStance | 'blank');
    }
  }
  return map;
}

const OPINION_SELECT = `
  id,
  title,
  body,
  stance,
  points,
  stortinget_issue_id,
  created_at,
  author_user_id,
  users:author_user_id (first_name, last_name, name)
`;

const REPLY_SELECT = `
  id,
  opinion_id,
  stance,
  body,
  created_at,
  updated_at,
  author_user_id,
  users:author_user_id (first_name, last_name, name)
`;

async function listSakPickerOptionsFromCache(limit: number, live: boolean): Promise<SakPickerOption[]> {
  const saker = live ? await getSakerWithCache() : getSakerFromMemoryCache();
  const seen = new Set<string>();
  const options: SakPickerOption[] = [];
  for (const sak of saker) {
    if (!sak.id || !sak.title || seen.has(sak.id)) continue;
    seen.add(sak.id);
    options.push({
      id: sak.id,
      title: sak.title,
      category: sak.category || null,
      henvisning: sak.henvisning ?? null,
      status: sak.status,
    });
    if (options.length >= limit) break;
  }
  return options;
}

async function listSakPickerOptionsFromDb(limit: number): Promise<SakPickerOption[]> {
  if (!supabaseConfigured()) return [];

  const supabase = getAnonSupabase();
  const withHenvisning = await supabase
    .from('stortinget_issues')
    .select('id, title, category, henvisning, ferdigbehandlet, status')
    .order('last_synced_at', { ascending: false })
    .limit(limit);

  const result = withHenvisning.error
    ? await supabase
        .from('stortinget_issues')
        .select('id, title, category, ferdigbehandlet, status')
        .order('last_synced_at', { ascending: false })
        .limit(limit)
    : withHenvisning;

  if (result.error) {
    console.error('listSakPickerOptions error:', result.error.message);
    return [];
  }

  return (result.data ?? [])
    .filter((row) => row.id && row.title)
    .map((row) => {
      const cachedStatus =
        typeof row.status === 'string' ? row.status : row.status != null ? String(row.status) : null;
      const ferdigbehandlet =
        typeof row.ferdigbehandlet === 'boolean' ? row.ferdigbehandlet : null;
      return {
        id: String(row.id),
        title: String(row.title),
        category: row.category ? String(row.category) : null,
        henvisning: 'henvisning' in row && row.henvisning ? String(row.henvisning) : null,
        status: resolveSakListStatus({ ferdigbehandlet, cachedStatus }),
      };
    });
}

export async function listSakPickerOptions(
  limit = 300,
  opts?: { live?: boolean },
): Promise<SakPickerOption[]> {
  const fromDb = await listSakPickerOptionsFromDb(limit);
  if (fromDb.length > 0) return fromDb;
  return listSakPickerOptionsFromCache(limit, opts?.live === true);
}

async function listCitizenOpinionsInternal(
  limit: number,
  issueId?: string | null,
  viewerUserId?: string | null,
): Promise<OpinionListItem[]> {
  if (!supabaseConfigured()) return [];

  const supabase = getAnonSupabase();
  let query = supabase
    .from('citizen_opinions')
    .select(OPINION_SELECT)
    .eq('is_removed', false)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (issueId) {
    query = query.eq('stortinget_issue_id', issueId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('listCitizenOpinions error:', error.message);
    return [];
  }

  const rows = (data ?? []) as OpinionRow[];
  const issueIds = rows
    .map((row) => row.stortinget_issue_id)
    .filter((id): id is string => Boolean(id));
  const opinionIds = rows.map((row) => row.id);
  const [issueTitles, countsById, pollIdByIssue, viewerStances] = await Promise.all([
    loadIssueTitles(issueIds),
    loadCountsByOpinion(opinionIds),
    loadPollIdByIssue(issueIds),
    loadViewerStances(opinionIds, viewerUserId ?? null),
  ]);

  return rows.map((row) => {
    const counts = countsById.get(row.id) ?? emptyStanceCounts();
    // Do not add the original opinion's stance to counts — "supporters" are replies only (Enig → For).
    const issueTitle = row.stortinget_issue_id ? issueTitles.get(row.stortinget_issue_id) ?? null : null;
    const pollId = row.stortinget_issue_id ? pollIdByIssue.get(row.stortinget_issue_id) ?? null : null;
    const viewerStance = viewerStances.get(row.id) ?? null;
    return mapOpinionRow(row, issueTitle, counts, pollId, viewerStance);
  });
}

export async function listCitizenOpinions(
  limit = OPINION_LIST_PAGE_SIZE,
  viewerUserId?: string | null,
): Promise<OpinionListItem[]> {
  return listCitizenOpinionsInternal(limit, undefined, viewerUserId);
}

export async function listCitizenOpinionsByIssue(
  issueId: string,
  limit = OPINION_LIST_PAGE_SIZE,
  viewerUserId?: string | null,
): Promise<OpinionListItem[]> {
  const id = issueId.trim();
  if (!id) return [];
  return listCitizenOpinionsInternal(limit, id, viewerUserId);
}

export type IssueOpinionSummary = {
  total: number;
  counts: OpinionStanceCounts;
  latest: OpinionListItem[];
};

/**
 * The most-endorsed for and imot opinions for a sak, plus the total count.
 * Shown on the matching Reel so undecided voters can read the best argument
 * on each side before voting (B3).
 */
export async function getIssueOpinionHighlights(
  issueId: string,
  viewerUserId?: string | null,
): Promise<IssueOpinionHighlights> {
  const opinions = await listCitizenOpinionsByIssue(issueId, 60, viewerUserId);
  let topFor: OpinionListItem | null = null;
  let topImot: OpinionListItem | null = null;
  for (const opinion of opinions) {
    if (opinion.stance === 'for' && (!topFor || opinion.counts.total > topFor.counts.total)) {
      topFor = opinion;
    }
    if (opinion.stance === 'imot' && (!topImot || opinion.counts.total > topImot.counts.total)) {
      topImot = opinion;
    }
  }
  return { total: opinions.length, for: topFor, imot: topImot };
}

export async function getIssueOpinionSummary(
  issueId: string,
  previewLimit = 3,
  viewerUserId?: string | null,
): Promise<IssueOpinionSummary> {
  const opinions = await listCitizenOpinionsByIssue(issueId, previewLimit * 2, viewerUserId);
  const counts = emptyStanceCounts();
  for (const opinion of opinions) {
    addStanceCount(counts, opinion.stance);
  }
  return {
    total: opinions.length,
    counts,
    latest: opinions.slice(0, Math.max(0, previewLimit)),
  };
}

export async function getSakPickerOption(id: string): Promise<SakPickerOption | null> {
  const sakId = id.trim();
  if (!sakId || !supabaseConfigured()) return null;

  const supabase = getAnonSupabase();
  const { data, error } = await supabase
    .from('stortinget_issues')
    .select('id, title, category, ferdigbehandlet, status')
    .eq('id', sakId)
    .maybeSingle();

  if (error || !data || !data.id || !data.title) {
    if (error) console.error('getSakPickerOption error:', error.message);
    return null;
  }

  const cachedStatus =
    typeof data.status === 'string' ? data.status : data.status != null ? String(data.status) : null;
  const ferdigbehandlet = typeof data.ferdigbehandlet === 'boolean' ? data.ferdigbehandlet : null;
  return {
    id: String(data.id),
    title: String(data.title),
    category: data.category ? String(data.category) : null,
    henvisning: null,
    status: resolveSakListStatus({ ferdigbehandlet, cachedStatus }),
  };
}

export async function getCitizenOpinion(id: string, viewerUserId?: string | null): Promise<OpinionDetail | null> {
  if (!supabaseConfigured() || !id) return null;

  const supabase = getAnonSupabase();
  const { data, error } = await supabase
    .from('citizen_opinions')
    .select(OPINION_SELECT)
    .eq('id', id)
    .eq('is_removed', false)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error('getCitizenOpinion error:', error.message);
    return null;
  }

  const row = data as OpinionRow;
  const [issueTitles, pollIdByIssue, replyResult] = await Promise.all([
    loadIssueTitles(row.stortinget_issue_id ? [row.stortinget_issue_id] : []),
    loadPollIdByIssue(row.stortinget_issue_id ? [row.stortinget_issue_id] : []),
    supabase
      .from('citizen_opinion_replies')
      .select(REPLY_SELECT)
      .eq('opinion_id', id)
      .eq('is_removed', false)
      .order('created_at', { ascending: true }),
  ]);

  if (replyResult.error) {
    console.error('getCitizenOpinion replies error:', replyResult.error.message);
  }

  const replies = ((replyResult.data ?? []) as ReplyRow[])
    .map(mapReplyRow)
    .filter((item): item is OpinionReplyItem => Boolean(item));

  const counts = emptyStanceCounts();
  // Do not add the original opinion's stance to counts — "supporters" are replies only (Enig → For).
  for (const reply of replies) addStanceCount(counts, reply.stance);

  const issueTitle = row.stortinget_issue_id ? issueTitles.get(row.stortinget_issue_id) ?? null : null;
  const pollId = row.stortinget_issue_id ? pollIdByIssue.get(row.stortinget_issue_id) ?? null : null;
  const listItem = mapOpinionRow(row, issueTitle, counts, pollId);
  const viewerReply = viewerUserId ? replies.find((reply) => reply.authorUserId === viewerUserId) ?? null : null;

  return {
    ...listItem,
    replies,
    viewerReply,
  };
}

export async function createCitizenOpinion(
  userId: string,
  input: {
    title: string;
    body: string;
    stance: unknown;
    points?: unknown;
    stortingetIssueId?: string | null;
  },
): Promise<string> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Tjenesten er ikke konfigurert');
  }

  const title = input.title.trim();
  const body = input.body.trim();
  const pointsResult = validateOpinionPoints(input.points);
  const errors = validateOpinionDraft({ title, body, stance: input.stance, points: input.points });
  if (hasOpinionFieldErrors(errors) || !isOpinionCreateStance(input.stance) || pointsResult.error) {
    throw new Error(errors.title || errors.body || errors.stance || errors.points || 'Ugyldig mening');
  }
  if (title.length < OPINION_TITLE_MIN || title.length > OPINION_TITLE_MAX) {
    throw new Error('Ugyldig tittel');
  }
  if (body.length > OPINION_BODY_MAX) {
    throw new Error('Ugyldig begrunnelse');
  }
  if (requiresOpinionBody(input.stance) && body.length < OPINION_BODY_MIN) {
    throw new Error('Ugyldig begrunnelse');
  }

  const service = getServiceSupabase();
  const { data, error } = await service.rpc('create_citizen_opinion', {
    p_user_id: userId,
    p_title: title,
    p_body: body,
    p_stance: input.stance,
    p_stortinget_issue_id: input.stortingetIssueId?.trim() || null,
    p_points: pointsResult.points,
  });

  if (error) {
    throw new Error(error.message);
  }

  return String(data);
}

export async function createCitizenOpinionReply(
  userId: string,
  opinionId: string,
  input: { body: string; stance: unknown; quick?: boolean },
): Promise<string> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Tjenesten er ikke konfigurert');
  }

  const body = input.body.trim();
  const quick = input.quick === true;
  const errors = validateReplyDraft({ body, stance: input.stance, quick });
  if (hasOpinionFieldErrors(errors) || !isOpinionStance(input.stance)) {
    throw new Error(errors.body || errors.stance || 'Ugyldig svar');
  }
  if (body.length > OPINION_BODY_MAX) {
    throw new Error('Ugyldig begrunnelse');
  }
  if (requiresOpinionBody(input.stance) && body.length < OPINION_REPLY_BODY_MIN && !(quick && (input.stance === 'for' || input.stance === 'imot'))) {
    throw new Error('Ugyldig begrunnelse');
  }

  const service = getServiceSupabase();
  const { data, error } = await service.rpc('create_citizen_opinion_reply', {
    p_user_id: userId,
    p_opinion_id: opinionId,
    p_stance: input.stance,
    p_body: body,
  });

  if (error) {
    throw new Error(error.message);
  }

  return String(data);
}
