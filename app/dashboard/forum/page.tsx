import { Suspense } from 'react';
import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import ForumPostCard from '@/components/forum/forum-post-card';
import ForumPromptCarousel from '@/components/forum/forum-prompt-carousel';
import ForumFeedToolbar from '@/components/forum/forum-feed-toolbar';
import ForumRightRail from '@/components/forum/forum-right-rail';
import { getForumThreads, getIssueTitle, getSuggestedIssues, type ForumSort } from '@/lib/forum/queries';
import { getActiveForumPrompts } from '@/lib/forum/prompt-queries';
import { canViewForumReels } from '@/lib/forum/reels-visibility';
import { routes } from '@/lib/routes';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';

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
        <header className="mb-6">
          <PageHeader
            title="Forum"
            description={
              reelsVisible
                ? 'Diskuter saker, still spørsmål og delta i dagens avstemninger.'
                : 'Diskuter saker og still spørsmål om politikk og samfunn.'
            }
          />
        </header>

        {sakId && (
          <div className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Filtrert på sak</p>
              <p className="font-semibold text-indigo-950 mt-0.5">{sakTitle || `Sak ${sakId}`}</p>
            </div>
            <div className="flex gap-3 text-sm">
              <Link href={routes.sak(sakId)} className="font-medium text-indigo-600 hover:text-indigo-500">
                Se saken
              </Link>
              <Link href={routes.forum} className="font-medium text-indigo-600 hover:text-indigo-500">
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
          <div className="text-center py-16 rounded-xl border border-dashed border-gray-200 bg-white">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium text-gray-700">
              {search
                ? `Ingen treff for «${search}»`
                : sakId
                  ? 'Ingen diskusjoner om denne saken ennå'
                  : 'Ingen diskusjoner ennå'}
            </p>
            {search && (
              <p className="text-sm text-gray-500 mt-1">Prøv andre ord eller fjern søkefilteret.</p>
            )}
            <Button render={<Link href={newThreadHref} />} className="mt-4">
              Start ny diskusjon
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {topics.map((topic) => (
              <ForumPostCard key={topic.id} topic={topic} />
            ))}
          </div>
        )}
      </div>

      <ForumRightRail recentThreads={topics} popularIssues={popularIssues} />
    </div>
  );
}
