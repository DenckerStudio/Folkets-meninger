import Link from 'next/link';
import FadeIn from '@/components/fade-in';
import { BackButton } from '@/components/dashboard/back-button';
import CreateThreadForm from './create-thread-form';
import { getIssueTitle, getSuggestedIssues } from '@/lib/forum/queries';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

export default async function NewForumThreadPage({
  searchParams,
}: {
  searchParams: Promise<{ sak?: string }>;
}) {
  const params = await searchParams;
  const sakId = params.sak?.trim() || null;
  const [sakTitle, suggestedIssues] = await Promise.all([
    sakId ? getIssueTitle(sakId) : Promise.resolve(null),
    getSuggestedIssues(),
  ]);

  const backFallback = sakId ? `${routes.forum}?sak=${sakId}` : routes.forum;

  return (
    <div className="mx-auto max-w-5xl pb-12">
      <FadeIn delay={0.05}>
        <header className="mb-8">
          <BackButton fallbackHref={backFallback} className="mb-4" />
          <div className="rounded-2xl border border-indigo-100/80 bg-gradient-to-br from-indigo-50 via-white to-white px-6 py-6 shadow-sm sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Ny tråd</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Start diskusjon
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-600 sm:text-base">
              Del synspunkter, still spørsmål og koble innlegget til saker, høringer og politikere.
            </p>
          </div>
        </header>

        <CreateThreadForm
          sakId={sakId}
          sakTitle={sakTitle}
          suggestedIssues={suggestedIssues}
        />
      </FadeIn>
    </div>
  );
}
