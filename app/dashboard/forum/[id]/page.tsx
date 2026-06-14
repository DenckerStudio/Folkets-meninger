import Link from 'next/link';
import { ArrowLeft, Clock, MessageCircle, CheckCircle, ShieldCheck } from 'lucide-react';
import { notFound } from 'next/navigation';
import LikeButton, { CommentCountPill, ShareThreadButton } from '@/components/forum/like-button';
import { ForumAuthorBadge } from '@/components/forum/forum-author-badge';
import { ForumReportButton } from '@/components/forum/forum-report-button';
import { FormattedForumBody } from '@/lib/forum/format-body';
import { ForumSourceList } from '@/components/forum/forum-source-card';
import { getForumThread } from '@/lib/forum/queries';
import { routes } from '@/lib/routes';
import ForumReplyForm from './reply-form';

export const dynamic = 'force-dynamic';

export default async function ForumPostPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const post = await getForumThread(resolvedParams.id);

  if (!post) {
    notFound();
  }

  const replyLikedSet = new Set(post.replyLikedIds);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <Link
        href={routes.forum}
        className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500"
      >
        <ArrowLeft className="mr-2 w-4 h-4" />
        Tilbake til forumet
      </Link>

      <article className="flex gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <div className="shrink-0">
          <LikeButton
            targetType="thread"
            targetId={post.id}
            initialCount={post.likes}
            initialLiked={post.threadLiked}
            variant="pill"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              {post.relatedIssueId && post.relatedIssueTitle && (
                <>
                  <Link href={routes.sak(post.relatedIssueId)} className="font-semibold text-gray-900 hover:underline">
                    r/{post.relatedIssueTitle.length > 40 ? `${post.relatedIssueTitle.slice(0, 40)}…` : post.relatedIssueTitle}
                  </Link>
                  <span>·</span>
                </>
              )}
              {post.author ? (
                <ForumAuthorBadge author={post.author} showPlatformHint={post.isSystemThread} />
              ) : (
                <span>Ukjent forfatter</span>
              )}
              <span>·</span>
              <span className="inline-flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1" />
                {post.createdAt}
              </span>
            </div>
            <ForumReportButton targetType="thread" targetId={post.id} />
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">{post.title}</h1>

          {post.contextItems.length > 0 && (
            <div className="mb-4">
              <ForumSourceList items={post.contextItems} />
            </div>
          )}

          <FormattedForumBody text={post.content} className="text-gray-700 leading-relaxed" />

          <div className="mt-4 flex flex-wrap gap-2">
            <CommentCountPill count={post.replies.length} />
            <ShareThreadButton threadId={post.id} />
          </div>
        </div>
      </article>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-gray-400" />
          Svar ({post.replies.length})
        </h2>

        {post.replies.length === 0 ? (
          <p className="text-center py-8 text-gray-500 text-sm">Ingen svar ennå. Vær den første!</p>
        ) : (
          <div className="space-y-3">
            {post.replies.map((reply) => (
              <article
                key={reply.id}
                id={`reply-${reply.id}`}
                className={`flex gap-3 rounded-xl border p-4 scroll-mt-24 ${
                  reply.isOfficialResponse ? 'border-indigo-300 bg-indigo-50/30' : 'border-gray-200 bg-white'
                }`}
              >
                <LikeButton
                  targetType="reply"
                  targetId={reply.id}
                  initialCount={reply.likes}
                  initialLiked={replyLikedSet.has(reply.id)}
                  variant="pill"
                />
                <div className="min-w-0 flex-1">
                  {reply.isOfficialResponse && (
                    <div className="text-xs font-bold text-indigo-800 mb-2 inline-flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Offisielt svar
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {reply.author ? (
                        <ForumAuthorBadge author={reply.author} />
                      ) : (
                        <span className="text-sm text-gray-500">Ukjent forfatter</span>
                      )}
                      {reply.isVerifiedPolitician && (
                        <span className="text-indigo-600 text-xs inline-flex items-center gap-0.5 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                          <ShieldCheck className="w-3 h-3" />
                          Verifisert
                        </span>
                      )}
                      <span className="text-xs text-gray-500">{reply.createdAt}</span>
                    </div>
                    <ForumReportButton targetType="reply" targetId={reply.id} />
                  </div>
                  <FormattedForumBody text={reply.content} className="text-gray-700 text-sm" />
                </div>
              </article>
            ))}
          </div>
        )}

        <ForumReplyForm threadId={post.id} />
      </section>
    </div>
  );
}
