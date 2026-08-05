import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { ensurePublicUser } from '@/lib/ensure-public-user';
import { createNotification, extractMentions, resolveMentionedUserIdsByName } from '@/lib/notifications';
import { mapForumRpcError } from '@/lib/forum/rpc-errors';
import {
  validateCreateReply,
  validateCreateThread,
  validateDeletePost,
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

      if (validated.stance && replyId) {
        const { error: stanceError } = await service
          .from('forum_replies')
          .update({ stance: validated.stance })
          .eq('id', replyId)
          .eq('author_user_id', user.id);
        if (stanceError) {
          console.error('Forum reply stance update error:', stanceError);
        }
      }

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

    if (action === 'delete_thread' || action === 'delete_reply') {
      const validated = validateDeletePost({
        target_type: action === 'delete_thread' ? 'thread' : 'reply',
        target_id: payload.target_id,
      });
      if (!validated.ok) {
        return NextResponse.json({ error: validated.error }, { status: 400 });
      }

      if (validated.targetType === 'thread') {
        const { data: thread, error: fetchError } = await service
          .from('forum_threads')
          .select('id, author_user_id, is_system_thread')
          .eq('id', validated.targetId)
          .maybeSingle();

        if (fetchError || !thread) {
          return NextResponse.json({ error: 'Tråden finnes ikke' }, { status: 404 });
        }
        if (thread.is_system_thread || thread.author_user_id !== user.id) {
          return NextResponse.json({ error: 'Du kan bare slette egne innlegg' }, { status: 403 });
        }

        const { error: deleteError } = await service
          .from('forum_threads')
          .delete()
          .eq('id', validated.targetId)
          .eq('author_user_id', user.id);

        if (deleteError) {
          console.error('Delete thread error:', deleteError);
          return NextResponse.json({ error: 'Kunne ikke slette tråden' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
      }

      const { data: reply, error: fetchError } = await service
        .from('forum_replies')
        .select('id, author_user_id')
        .eq('id', validated.targetId)
        .maybeSingle();

      if (fetchError || !reply) {
        return NextResponse.json({ error: 'Svaret finnes ikke' }, { status: 404 });
      }
      if (reply.author_user_id !== user.id) {
        return NextResponse.json({ error: 'Du kan bare slette egne innlegg' }, { status: 403 });
      }

      const { error: deleteError } = await service
        .from('forum_replies')
        .delete()
        .eq('id', validated.targetId)
        .eq('author_user_id', user.id);

      if (deleteError) {
        console.error('Delete reply error:', deleteError);
        return NextResponse.json({ error: 'Kunne ikke slette svaret' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
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
