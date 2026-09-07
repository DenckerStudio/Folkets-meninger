import { resolvePublicAuthor } from '@/lib/identity/public-identity';
import { addStanceCount, emptyStanceCounts } from '@/lib/opinions/labels';
import {
  OPINION_BODY_MAX,
  OPINION_BODY_MIN,
  OPINION_LIST_PAGE_SIZE,
  OPINION_REPLY_BODY_MIN,
  OPINION_TITLE_MAX,
  OPINION_TITLE_MIN,
  type OpinionDetail,
  type OpinionListItem,
  type OpinionReplyItem,
  type OpinionStance,
  type OpinionStanceCounts,
  type SakPickerOption,
} from '@/lib/opinions/types';
import { hasOpinionFieldErrors, isOpinionStance, validateOpinionDraft, validateReplyDraft } from '@/lib/opinions/validate';
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

function mapOpinionRow(row: OpinionRow, issueTitle: string | null, counts: OpinionStanceCounts): OpinionListItem {
  const author = mapAuthor(row.author_user_id, row.users);
  const stance: OpinionStance = isOpinionStance(row.stance) ? row.stance : 'blank';
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    stance,
    stortingetIssueId: row.stortinget_issue_id,
    issueTitle,
    createdAt: row.created_at,
    authorUserId: row.author_user_id,
    authorName: author.name,
    authorInitials: author.initials,
    counts,
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

const OPINION_SELECT = `
  id,
  title,
  body,
  stance,
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

export async function listSakPickerOptions(limit = 300): Promise<SakPickerOption[]> {
  if (!supabaseConfigured()) return [];

  const supabase = getAnonSupabase();
  const { data, error } = await supabase
    .from('stortinget_issues')
    .select('id, title, category')
    .order('last_synced_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('listSakPickerOptions error:', error.message);
    return [];
  }

  return (data ?? [])
    .filter((row) => row.id && row.title)
    .map((row) => ({
      id: String(row.id),
      title: String(row.title),
      category: row.category ? String(row.category) : null,
    }));
}

export async function listCitizenOpinions(limit = OPINION_LIST_PAGE_SIZE): Promise<OpinionListItem[]> {
  if (!supabaseConfigured()) return [];

  const supabase = getAnonSupabase();
  const { data, error } = await supabase
    .from('citizen_opinions')
    .select(OPINION_SELECT)
    .eq('is_removed', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('listCitizenOpinions error:', error.message);
    return [];
  }

  const rows = (data ?? []) as OpinionRow[];
  const issueTitles = await loadIssueTitles(
    rows.map((row) => row.stortinget_issue_id).filter((id): id is string => Boolean(id)),
  );
  const countsById = await loadCountsByOpinion(rows.map((row) => row.id));

  return rows.map((row) => {
    const counts = countsById.get(row.id) ?? emptyStanceCounts();
    if (isOpinionStance(row.stance)) {
      addStanceCount(counts, row.stance);
    }
    const issueTitle = row.stortinget_issue_id ? issueTitles.get(row.stortinget_issue_id) ?? null : null;
    return mapOpinionRow(row, issueTitle, counts);
  });
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
  const [issueTitles, replyResult] = await Promise.all([
    loadIssueTitles(row.stortinget_issue_id ? [row.stortinget_issue_id] : []),
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
  if (isOpinionStance(row.stance)) addStanceCount(counts, row.stance);
  for (const reply of replies) addStanceCount(counts, reply.stance);

  const issueTitle = row.stortinget_issue_id ? issueTitles.get(row.stortinget_issue_id) ?? null : null;
  const listItem = mapOpinionRow(row, issueTitle, counts);
  const viewerReply = viewerUserId ? replies.find((reply) => reply.authorUserId === viewerUserId) ?? null : null;

  return {
    ...listItem,
    replies,
    viewerReply,
  };
}

export async function createCitizenOpinion(
  userId: string,
  input: { title: string; body: string; stance: unknown; stortingetIssueId?: string | null },
): Promise<string> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Tjenesten er ikke konfigurert');
  }

  const title = input.title.trim();
  const body = input.body.trim();
  const errors = validateOpinionDraft({ title, body, stance: input.stance });
  if (hasOpinionFieldErrors(errors) || !isOpinionStance(input.stance)) {
    throw new Error(errors.title || errors.body || errors.stance || 'Ugyldig mening');
  }
  if (title.length < OPINION_TITLE_MIN || title.length > OPINION_TITLE_MAX) {
    throw new Error('Ugyldig tittel');
  }
  if (body.length < OPINION_BODY_MIN || body.length > OPINION_BODY_MAX) {
    throw new Error('Ugyldig begrunnelse');
  }

  const service = getServiceSupabase();
  const { data, error } = await service.rpc('create_citizen_opinion', {
    p_user_id: userId,
    p_title: title,
    p_body: body,
    p_stance: input.stance,
    p_stortinget_issue_id: input.stortingetIssueId?.trim() || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return String(data);
}

export async function createCitizenOpinionReply(
  userId: string,
  opinionId: string,
  input: { body: string; stance: unknown },
): Promise<string> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Tjenesten er ikke konfigurert');
  }

  const body = input.body.trim();
  const errors = validateReplyDraft({ body, stance: input.stance });
  if (hasOpinionFieldErrors(errors) || !isOpinionStance(input.stance)) {
    throw new Error(errors.body || errors.stance || 'Ugyldig svar');
  }
  if (body.length < OPINION_REPLY_BODY_MIN || body.length > OPINION_BODY_MAX) {
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
