import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { routes } from '@/lib/routes';
import type { ForumThreadListItem } from '@/lib/forum/queries';
import { ForumRulesPanel } from '@/components/forum/forum-rules-panel';

type ForumRightRailProps = {
  recentThreads: Pick<ForumThreadListItem, 'id' | 'title' | 'replies' | 'likes'>[];
  popularIssues: { id: string; title: string }[];
};

export default function ForumRightRail({ recentThreads, popularIssues }: ForumRightRailProps) {
  return (
    <aside className="space-y-4">
      {popularIssues.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Mest engasjerte saker</h3>
          <ul className="space-y-2">
            {popularIssues.map((issue) => (
              <li key={issue.id}>
                <Link
                  href={`${routes.forum}?sak=${issue.id}#del-din-mening`}
                  className="text-sm text-indigo-600 hover:text-indigo-500 line-clamp-2 font-medium"
                >
                  {issue.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recentThreads.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-gray-400" />
            Nylige tråder
          </h3>
          <ul className="space-y-3">
            {recentThreads.slice(0, 5).map((thread) => (
              <li key={thread.id}>
                <Link href={routes.forumTopic(thread.id)} className="block group">
                  <p className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-indigo-600">
                    {thread.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {thread.likes} likes · {thread.replies} svar
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ForumRulesPanel className="rounded-xl border border-gray-200 bg-white p-5" />
    </aside>
  );
}
