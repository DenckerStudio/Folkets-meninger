import type { ReactNode } from 'react';
import Link from 'next/link';
import { routes } from '@/lib/routes';
import type { ForumThreadListItem } from '@/lib/forum/queries';
import { ForumRulesPanel } from '@/components/forum/forum-rules-panel';

type ForumRightRailProps = {
  recentThreads: Pick<ForumThreadListItem, 'id' | 'title' | 'replies' | 'likes'>[];
  popularIssues: { id: string; title: string }[];
};

function RailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

export default function ForumRightRail({ recentThreads, popularIssues }: ForumRightRailProps) {
  return (
    <aside className="space-y-8 lg:pt-2">
      {popularIssues.length > 0 ? (
        <RailSection title="Engasjerte saker">
          <ul className="space-y-2.5">
            {popularIssues.map((issue) => (
              <li key={issue.id}>
                <Link
                  href={`${routes.forum}?sak=${issue.id}#del-din-mening`}
                  className="text-sm font-medium leading-snug text-foreground line-clamp-2 hover:text-indigo-600 dark:text-indigo-400"
                >
                  {issue.title}
                </Link>
              </li>
            ))}
          </ul>
        </RailSection>
      ) : null}

      {recentThreads.length > 0 ? (
        <RailSection title="Nylig aktivitet">
          <ul className="space-y-3">
            {recentThreads.slice(0, 5).map((thread) => (
              <li key={thread.id}>
                <Link href={routes.forumTopic(thread.id)} className="block group">
                  <p className="text-sm font-medium leading-snug text-foreground line-clamp-2 group-hover:text-indigo-600 dark:text-indigo-400">
                    {thread.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {thread.likes} likes · {thread.replies} svar
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </RailSection>
      ) : null}

      <ForumRulesPanel />
    </aside>
  );
}
