import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import FadeIn from '@/components/fade-in';
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

  const backHref = sakId ? `${routes.forum}?sak=${sakId}` : routes.forum;

  return (
    <div className="mx-auto max-w-5xl pb-12">
      <FadeIn delay={0.05}>
        <header className="mb-8">
          <Link
            href={backHref}
            className="mb-4 inline-flex items-center text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-500"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Tilbake til forumet
          </Link>
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
