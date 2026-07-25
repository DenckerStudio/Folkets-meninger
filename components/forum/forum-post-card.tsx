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
    ? topic.relatedIssueTitle.length > 56
      ? `${topic.relatedIssueTitle.slice(0, 56)}…`
      : topic.relatedIssueTitle
    : null;

  return (
    <article className="group py-5 transition-colors hover:bg-gray-50/60 -mx-3 px-3 sm:-mx-4 sm:px-4 rounded-2xl">
      <div className="flex gap-3 sm:gap-4">
        <div className="shrink-0 pt-0.5">
          <LikeButton
            targetType="thread"
            targetId={topic.id}
            initialCount={topic.likes}
            variant="pill"
            stopPropagation
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
            {topic.relatedIssueId && sakLabel ? (
              <Link
                href={routes.sak(topic.relatedIssueId)}
                className="font-medium text-gray-700 hover:text-indigo-600"
              >
                {sakLabel}
              </Link>
            ) : null}
            {topic.relatedIssueId && sakLabel ? <span className="text-gray-300">·</span> : null}
            {topic.author ? (
              <ForumAuthorBadge author={topic.author} className="!gap-1.5" />
            ) : (
              <span className="text-gray-400">Ukjent forfatter</span>
            )}
            <span className="text-gray-300">·</span>
            <time>{topic.createdAt}</time>
            <span className="ml-auto opacity-0 transition-opacity group-hover:opacity-100">
              <ForumPostCardMenu threadId={topic.id} authorUserId={topic.authorUserId} />
            </span>
          </div>

          <Link href={routes.forumTopic(topic.id)} className="block">
            <h3 className="text-[1.05rem] font-semibold leading-snug text-gray-900 transition-colors group-hover:text-indigo-700 sm:text-lg">
              <span className="line-clamp-3">{topic.title}</span>
            </h3>

            {topic.isResolved ? (
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                <CheckCircle className="h-3.5 w-3.5" aria-hidden />
                Besvart
              </span>
            ) : null}

            {topic.bodyExcerpt ? (
              <p className="mt-2 text-sm leading-relaxed text-gray-600 line-clamp-2">{topic.bodyExcerpt}</p>
            ) : null}
          </Link>

          {topic.contextItems.length > 0 ? (
            <div className="mt-3">
              <ForumSourceList items={topic.contextItems.slice(0, 2)} variant="compact" />
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-1">
            <Link href={routes.forumTopic(topic.id)} className="inline-flex">
              <CommentCountPill count={topic.replies} />
            </Link>
            <ShareThreadButton threadId={topic.id} />
          </div>
        </div>
      </div>
    </article>
  );
}
