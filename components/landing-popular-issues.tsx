import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { routes } from '@/lib/routes';
import FadeIn from '@/components/fade-in';

export type LandingIssue = {
  id: string;
  title: string;
  summary: string;
  category: string;
  date: string;
};

type LandingPopularIssuesProps = {
  issues: LandingIssue[];
};

export function LandingPopularIssues({ issues }: LandingPopularIssuesProps) {
  return (
    <FadeIn delay={0.3} direction="up">
      <section>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Populære saker nå</h2>
            <p className="mt-2 text-gray-600 max-w-xl">
              Lovforslag og representantforslag fra Stortinget — les om sakene og del ja/nei-meninger i forumet.
            </p>
          </div>
          <Link
            href={`${routes.login}?next=${encodeURIComponent(routes.utforsk)}`}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 flex items-center shrink-0"
          >
            Logg inn for alle saker <ArrowRight className="ml-1 w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
          {issues.map((issue) => (
            <Link
              key={issue.id}
              href={routes.sak(issue.id)}
              className="group flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all overflow-hidden"
            >
              <div className="p-6 flex-grow">
                <div className="flex items-center justify-between mb-4 gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 truncate">
                    {issue.category}
                  </span>
                  <span className="text-sm text-gray-500 shrink-0">Oppdatert: {issue.date}</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors line-clamp-2">
                  {issue.title}
                </h3>
                <p className="text-gray-600 line-clamp-2">{issue.summary}</p>
              </div>
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end">
                <span className="text-indigo-600 text-sm font-medium flex items-center group-hover:text-indigo-700">
                  Les saken <ArrowRight className="ml-1 w-4 h-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </FadeIn>
  );
}
