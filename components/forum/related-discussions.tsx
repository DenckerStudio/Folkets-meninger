import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import type { ForumThreadListItem } from '@/lib/forum/queries';
import { routes } from '@/lib/routes';

type RelatedDiscussionsProps = {
  sakTitle: string;
  sakId: string;
  threads: ForumThreadListItem[];
};

export function RelatedDiscussions({ sakTitle, sakId, threads }: RelatedDiscussionsProps) {
  if (threads.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground mb-1">
        Andre diskusjoner om sak:{' '}
        <Link href={routes.sak(sakId)} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500">
          {sakTitle}
        </Link>
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        {threads.length} {threads.length === 1 ? 'annen tråd' : 'andre tråder'} om samme sak
      </p>
      <ul className="space-y-2">
        {threads.map((thread) => (
          <li key={thread.id}>
            <Link
              href={routes.forumTopic(thread.id)}
              className="flex items-start gap-3 rounded-xl border border-border px-4 py-3 hover:border-indigo-200 hover:bg-indigo-50 dark:bg-indigo-950/40/30 transition-colors"
            >
              <MessageSquare className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground line-clamp-2">{thread.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {thread.replies} svar · {thread.likes} liker · {thread.createdAt}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href={`${routes.forum}?sak=${sakId}`}
        className="inline-block mt-4 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
      >
        Se alle diskusjoner om saken →
      </Link>
    </section>
  );
}
