import { Suspense } from 'react';
import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import ForumPostCard from '@/components/forum/forum-post-card';
import ForumPromptCarousel from '@/components/forum/forum-prompt-carousel';
import ForumFeedToolbar from '@/components/forum/forum-feed-toolbar';
import ForumRightRail from '@/components/forum/forum-right-rail';
import { ForumOpinionComposer } from '@/components/forum/forum-opinion-composer';
import { ForumRulesPanel } from '@/components/forum/forum-rules-panel';
import { getForumThreads, getIssueTitle, getSuggestedIssues, type ForumSort } from '@/lib/forum/queries';
import { getActiveForumPrompts } from '@/lib/forum/prompt-queries';
import { canViewForumReels } from '@/lib/forum/reels-visibility';
import { routes } from '@/lib/routes';
import { PageHeader } from '@/components/page-header';

export const dynamic = 'force-dynamic';

export default async function ForumPage({
  searchParams,
}: {
  searchParams: Promise<{ sak?: string; sort?: string; q?: string }>;
}) {
  const params = await searchParams;
  const sakId = params.sak?.trim() || null;
  const sort = (params.sort === 'engasjert' ? 'engasjert' : 'nyeste') as ForumSort;
  const search = params.q?.trim() || null;
  const sakTitle = sakId ? await getIssueTitle(sakId) : null;

  const [topics, prompts, popularIssues, reelsVisible] = await Promise.all([
    getForumThreads({ sakId, sort, search }),
    getActiveForumPrompts(12),
    getSuggestedIssues(6),
    canViewForumReels(),
  ]);

  const newThreadHref = sakId ? routes.forumNew(sakId) : routes.forumNew();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-6">
      <div>
        <header className="mb-5">
          <PageHeader
            title="Forum"
            description={
              reelsVisible
                ? 'Diskuter saker og delta i debatten.'
                : 'Del meninger og følg diskusjoner om politikk og samfunn.'
            }
            className="space-y-1"
          />
        </header>

        <ForumOpinionComposer
          sakId={sakId}
          sakTitle={sakTitle}
          suggestedIssues={popularIssues}
        />

        {sakId && (
          <div className="mb-6 flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground">
              <span className="text-muted-foreground">Filtrert:</span>{' '}
              <span className="font-medium text-foreground">{sakTitle || `Sak ${sakId}`}</span>
            </p>
            <div className="flex gap-4">
              <Link href={routes.sak(sakId)} className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500">
                Se saken
              </Link>
              <Link href={routes.forum} className="font-medium text-muted-foreground hover:text-foreground">
                Vis alle
              </Link>
            </div>
          </div>
        )}

        {reelsVisible ? <ForumPromptCarousel prompts={prompts} /> : null}

        <Suspense fallback={null}>
          <ForumFeedToolbar />
        </Suspense>

        {topics.length === 0 ? (
          <div className="py-16 text-center">
            <MessageSquare className="mx-auto mb-4 h-10 w-10 text-muted-foreground/40" />
            <p className="text-base font-medium text-foreground">
              {search
                ? `Ingen treff for «${search}»`
                : sakId
                  ? 'Ingen diskusjoner om denne saken ennå'
                  : 'Ingen diskusjoner ennå'}
            </p>
            {search && (
              <p className="text-sm text-muted-foreground mt-1">Prøv andre ord eller fjern søkefilteret.</p>
            )}
            <Link
              href={newThreadHref}
              className="mt-4 inline-flex text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
            >
              Del din mening øverst på siden →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {topics.map((topic) => (
              <ForumPostCard key={topic.id} topic={topic} />
            ))}
          </div>
        )}

        <ForumRulesPanel className="mt-10 lg:hidden" />
      </div>

      <ForumRightRail recentThreads={topics} popularIssues={popularIssues} />
    </div>
  );
}
