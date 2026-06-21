'use client';

import { useAuth } from '@/hooks/use-auth';
import { ForumPostActions } from '@/components/forum/forum-post-actions';

type ForumPostCardMenuProps = {
  threadId: string;
  authorUserId?: string | null;
};

export function ForumPostCardMenu({ threadId, authorUserId }: ForumPostCardMenuProps) {
  const { user } = useAuth();
  const isOwner = Boolean(user && authorUserId && user.id === authorUserId);

  return (
    <ForumPostActions
      targetType="thread"
      targetId={threadId}
      isOwner={isOwner}
      redirectAfterThreadDelete={undefined}
    />
  );
}
