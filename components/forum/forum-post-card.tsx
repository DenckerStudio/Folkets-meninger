import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import LikeButton, { CommentCountPill, ShareThreadButton } from '@/components/forum/like-button';
import { ForumAuthorBadge } from '@/components/forum/forum-author-badge';
import { ForumSourceList } from '@/components/forum/forum-source-card';
import { ForumPostCardMenu } from '@/components/forum/forum-post-card-menu';
import type { ForumThreadListItem } from '@/lib/forum/queries';
import { routes } from '@/lib/routes';

export default function ForumPostCard({ topic }: { topic: ForumThreadListItem }) {
  const sakLabel = topic.relatedIssueTitle
    ? topic.relatedIssueTitle.length > 48
      ? `${topic.relatedIssueTitle.slice(0, 48)}…`
      : topic.relatedIssueTitle
    : null;

  return (
    <article className="flex gap-3 sm:gap-4 rounded-xl border border-gray-200 bg-white p-3 sm:p-4 hover:border-gray-300 transition-colors">
      <div className="shrink-0 pt-1">
        <LikeButton
          targetType="thread"
          targetId={topic.id}
          initialCount={topic.likes}
          variant="pill"
          stopPropagation
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 mb-1">
          {topic.relatedIssueId && sakLabel && (
            <Link
              href={routes.sak(topic.relatedIssueId)}
              className="font-semibold text-gray-900 hover:underline"
            >
              r/{sakLabel}
            </Link>
          )}
          {topic.relatedIssueId && sakLabel && <span>·</span>}
          {topic.author ? (
            <ForumAuthorBadge author={topic.author} className="!gap-1.5" />
          ) : (
            <span className="text-gray-400">Ukjent forfatter</span>
          )}
          <span>·</span>
          <span>{topic.createdAt}</span>
          <span className="ml-auto">
            <ForumPostCardMenu threadId={topic.id} />
          </span>
        </div>

        <Link href={routes.forumTopic(topic.id)} className="block group">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors flex items-start gap-2">
            <span className="line-clamp-2">{topic.title}</span>
            {topic.isResolved && (
              <span className="inline-flex items-center shrink-0 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                <CheckCircle className="w-3 h-3 mr-0.5" />
                Besvart
              </span>
            )}
          </h3>

          {topic.bodyExcerpt && (
            <p className="mt-1.5 text-sm text-gray-600 line-clamp-2">{topic.bodyExcerpt}</p>
          )}
        </Link>

        {topic.contextItems.length > 0 && (
          <div className="mt-3">
            <ForumSourceList items={topic.contextItems.slice(0, 2)} variant="compact" />
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link href={routes.forumTopic(topic.id)}>
            <CommentCountPill count={topic.replies} />
          </Link>
          <ShareThreadButton threadId={topic.id} />
        </div>
      </div>
    </article>
  );
}
