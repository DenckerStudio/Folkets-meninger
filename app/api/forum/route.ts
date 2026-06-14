import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { ensurePublicUser } from '@/lib/ensure-public-user';
import { createNotification, extractMentions, resolveMentionedUserIdsByName } from '@/lib/notifications';
import { mapForumRpcError } from '@/lib/forum/rpc-errors';
import {
  validateCreateReply,
  validateCreateThread,
  validateToggleLike,
} from '@/lib/forum/validation';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
    }

    await ensurePublicUser(user);

    const { action, ...payload } = await request.json();
    const service = getServiceSupabase();

    if (action === 'create_thread') {
      const validated = validateCreateThread(payload);
      if (!validated.ok) {
        return NextResponse.json({ error: validated.error }, { status: 400 });
      }

      const { data, error } = await service.rpc('create_forum_thread', {
        p_user_id: user.id,
        p_title: validated.title,
        p_body: validated.body,
        p_stortinget_issue_id: validated.stortingetIssueId,
        p_context_items: validated.contextItems,
        p_is_system_thread: false,
      });
      if (error) {
        console.error('Create thread error:', error);
        const msg = mapForumRpcError(error.message);
        const status = msg.includes('fornavn') ? 400 : 500;
        return NextResponse.json({ error: msg }, { status });
      }

      const origin = new URL(request.url).origin;
      const threadId = data as string;

      const mentionNames = extractMentions(validated.body);
      const mentionedUserIds = await resolveMentionedUserIdsByName(mentionNames);
      await Promise.all(
        mentionedUserIds
          .filter((id) => id !== user.id)
          .map((mentionedUserId) =>
            createNotification({
              userId: mentionedUserId,
              type: 'mention',
              channel: 'mentions',
              title: 'Du ble nevnt i en ny forumtråd',
              body: validated.title ? `Tråd: ${validated.title}` : null,
              url: `/dashboard/forum/${threadId}`,
              data: { threadId, byUserId: user.id },
              origin,
            })
          )
      );

      return NextResponse.json({ success: true, threadId: data });
    }

    if (action === 'create_reply') {
      const validated = validateCreateReply(payload);
      if (!validated.ok) {
        return NextResponse.json({ error: validated.error }, { status: 400 });
      }

      const { data, error } = await service.rpc('create_forum_reply', {
        p_user_id: user.id,
        p_thread_id: validated.threadId,
        p_body: validated.body,
        p_parent_reply_id: null,
        p_is_official_response: payload.is_official_response || false,
      });
      if (error) {
        console.error('Create reply error:', error);
        const msg = mapForumRpcError(error.message);
        const status = msg.includes('fornavn') ? 400 : 500;
        return NextResponse.json({ error: msg }, { status });
      }

      const origin = new URL(request.url).origin;
      const threadId = validated.threadId;
      const replyId = data as string;

      const { data: thread } = await service
        .from('forum_threads')
        .select('id,title,author_user_id')
        .eq('id', threadId)
        .maybeSingle();

      const recipients = new Set<string>();
      if (thread?.author_user_id && thread.author_user_id !== user.id) {
        recipients.add(thread.author_user_id);
      }

      const mentionNames = extractMentions(validated.body);
      const mentionedUserIds = await resolveMentionedUserIdsByName(mentionNames);
      for (const mentionedUserId of mentionedUserIds) {
        if (mentionedUserId !== user.id) recipients.add(mentionedUserId);
      }

      await Promise.all(
        [...recipients].map((recipientId) => {
          const isMention = mentionedUserIds.includes(recipientId);
          return createNotification({
            userId: recipientId,
            type: isMention ? 'mention' : 'forum_reply',
            channel: isMention ? 'mentions' : 'forum',
            title: isMention ? 'Du ble nevnt i forumet' : 'Nytt svar i en tråd du følger',
            body: thread?.title ? `Tråd: ${thread.title}` : null,
            url: `/dashboard/forum/${threadId}`,
            data: { threadId, replyId, byUserId: user.id },
            origin,
          });
        })
      );

      return NextResponse.json({ success: true, replyId: data });
    }

    if (action === 'toggle_like') {
      const validated = validateToggleLike(payload);
      if (!validated.ok) {
        return NextResponse.json({ error: validated.error }, { status: 400 });
      }

      const { data, error } = await service.rpc('toggle_forum_like', {
        p_user_id: user.id,
        p_target_type: validated.targetType,
        p_target_id: validated.targetId,
      });

      if (error) {
        console.error('Toggle like error:', error);
        return NextResponse.json({ error: 'Kunne ikke oppdatere like' }, { status: 500 });
      }

      return NextResponse.json({ liked: data });
    }

    return NextResponse.json({ error: 'Ukjent handling' }, { status: 400 });
  } catch (error) {
    console.error('Forum API error:', error);
    return NextResponse.json({ error: 'En feil oppstod' }, { status: 500 });
  }
}
