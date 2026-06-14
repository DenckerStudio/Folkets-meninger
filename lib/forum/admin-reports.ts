import { getServiceSupabase } from '@/lib/supabase';
import type { ForumReportListItem } from '@/lib/forum/reports';

export type { ForumReportListItem };

function excerpt(text: string, max = 160): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export async function listOpenForumReports(limit = 50): Promise<ForumReportListItem[]> {
  const service = getServiceSupabase();
  const { data: reports, error } = await service
    .from('forum_reports')
    .select('id, target_type, target_id, category, reason, status, admin_note, created_at')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !reports?.length) {
    if (error) console.error('listOpenForumReports', error);
    return [];
  }

  const threadIds = new Set<string>();
  const replyIds: string[] = [];

  for (const r of reports) {
    if (r.target_type === 'thread') threadIds.add(r.target_id);
    else replyIds.push(r.target_id);
  }

  const threadsById = new Map<string, { title: string; body: string; author_user_id: string | null }>();
  const repliesById = new Map<
    string,
    { body: string; thread_id: string; author_user_id: string }
  >();

  if (threadIds.size > 0) {
    const { data } = await service
      .from('forum_threads')
      .select('id, title, body, author_user_id')
      .in('id', [...threadIds]);
    for (const t of data ?? []) {
      threadsById.set(t.id, t);
    }
  }

  if (replyIds.length > 0) {
    const { data } = await service
      .from('forum_replies')
      .select('id, body, thread_id, author_user_id')
      .in('id', replyIds);
    for (const r of data ?? []) {
      repliesById.set(r.id, r);
      threadIds.add(r.thread_id);
    }
  }

  const extraThreadIds = [...threadIds].filter((id) => !threadsById.has(id));
  if (extraThreadIds.length > 0) {
    const { data } = await service
      .from('forum_threads')
      .select('id, title, body, author_user_id')
      .in('id', extraThreadIds);
    for (const t of data ?? []) {
      threadsById.set(t.id, t);
    }
  }

  const authorIds = new Set<string>();
  for (const t of threadsById.values()) {
    if (t.author_user_id) authorIds.add(t.author_user_id);
  }
  for (const r of repliesById.values()) {
    authorIds.add(r.author_user_id);
  }

  const usersById = new Map<string, { first_name: string | null; last_name: string | null }>();
  if (authorIds.size > 0) {
    const { data } = await service
      .from('users')
      .select('id, first_name, last_name')
      .in('id', [...authorIds]);
    for (const u of data ?? []) {
      usersById.set(u.id, u);
    }
  }

  function authorName(userId: string | null): string | null {
    if (!userId) return null;
    const u = usersById.get(userId);
    if (!u?.first_name || !u?.last_name) return null;
    return `${u.first_name} ${u.last_name}`.trim();
  }

  return reports.map((r) => {
    if (r.target_type === 'thread') {
      const t = threadsById.get(r.target_id);
      return {
        id: r.id,
        targetType: 'thread' as const,
        targetId: r.target_id,
        category: r.category,
        reason: r.reason,
        status: r.status,
        adminNote: r.admin_note,
        createdAt: r.created_at,
        targetTitle: t?.title ?? 'Slettet tråd',
        targetExcerpt: t ? excerpt(t.body) : '',
        targetAuthorName: authorName(t?.author_user_id ?? null),
        threadId: r.target_id,
      };
    }

    const reply = repliesById.get(r.target_id);
    const thread = reply ? threadsById.get(reply.thread_id) : undefined;
    return {
      id: r.id,
      targetType: 'reply' as const,
      targetId: r.target_id,
      category: r.category,
      reason: r.reason,
      status: r.status,
      adminNote: r.admin_note,
      createdAt: r.created_at,
      targetTitle: thread?.title ?? 'Slettet tråd',
      targetExcerpt: reply ? excerpt(reply.body) : '',
      targetAuthorName: reply ? authorName(reply.author_user_id) : null,
      threadId: reply?.thread_id ?? r.target_id,
    };
  });
}

export async function updateForumReportStatus(
  reportId: string,
  status: 'reviewed' | 'dismissed',
  adminNote?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const service = getServiceSupabase();
  const { error } = await service
    .from('forum_reports')
    .update({
      status,
      admin_note: adminNote?.trim().slice(0, 1000) ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', reportId);

  if (error) {
    console.error('updateForumReportStatus', error);
    return { ok: false, error: 'Kunne ikke oppdatere rapport' };
  }
  return { ok: true };
}
