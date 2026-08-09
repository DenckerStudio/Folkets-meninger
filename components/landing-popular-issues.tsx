import Link from 'next/link';
import { ArrowRight, Users } from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import { routes } from '@/lib/routes';
import FadeIn from '@/components/fade-in';

export type LandingIssue = {
  id: string;
  title: string;
  summary: string;
  category: string;
  date: string;
  votes: { for: number; against: number; total: number };
};

type LandingPopularIssuesProps = {
  issues: LandingIssue[];
};

export function LandingPopularIssues({ issues }: LandingPopularIssuesProps) {
  return (
    <FadeIn delay={0.22} direction="up">
      <section>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ba0c2f] mb-3">Engasjement</p>
            <h2 className="text-balance text-3xl font-bold tracking-tight text-[#001433] sm:text-4xl">
              Populære saker nå
            </h2>
            <p className="text-pretty mt-3 max-w-xl text-base leading-relaxed text-[#001433]/65">
              Aktuelle lovforslag og representantforslag fra Stortinget — der flest engasjerer seg akkurat nå.
            </p>
          </div>
          <Link
            href={`${routes.login}?next=${encodeURIComponent(routes.utforsk)}`}
            className="inline-flex items-center text-sm font-semibold text-[#00205b] hover:text-[#ba0c2f] transition-colors shrink-0"
          >
            Logg inn for alle saker <ArrowRight className="ml-1 w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {issues.map((issue) => {
            const forPercent = Math.round((issue.votes.for / issue.votes.total) * 100) || 0;
            const againstPercent = Math.round((issue.votes.against / issue.votes.total) * 100) || 0;

            return (
              <Link
                key={issue.id}
                href={routes.sak(issue.id)}
                className="group flex flex-col rounded-2xl border border-[#00205b]/10 bg-white overflow-hidden transition-all hover:border-[#00205b]/30 hover:shadow-[0_8px_30px_rgba(0,32,91,0.06)]"
              >
                <div className="p-6 flex-grow">
                  <div className="flex items-center justify-between mb-4 gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border border-[#00205b]/12 bg-[#00205b]/[0.05] text-[#00205b] truncate">
                      {issue.category}
                    </span>
                    <span className="text-sm text-[#001433]/50 shrink-0">Votering: {issue.date}</span>
                  </div>
                  <h3 className="text-xl font-semibold text-[#001433] mb-2 transition-colors group-hover:text-[#ba0c2f] line-clamp-2">
                    {issue.title}
                  </h3>
                  <p className="text-[#001433]/65 line-clamp-2 mb-4">{issue.summary}</p>
                  <div className="flex items-center text-sm text-[#001433]/55">
                    <Users className="w-4 h-4 mr-1.5 shrink-0" />
                    {formatNumber(issue.votes.total)} har stemt
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-[#00205b]/8 bg-[#00205b]/[0.02] flex flex-col gap-3 mt-auto">
                  <div className="flex gap-0.5 w-full h-1.5 bg-[#00205b]/10 rounded-full overflow-hidden">
                    <div className="bg-[#00205b]" style={{ width: `${forPercent}%` }} />
                    <div className="bg-[#ba0c2f]" style={{ width: `${againstPercent}%` }} />
                  </div>
                  <div className="flex justify-between items-center w-full">
                    <span className="text-xs font-medium text-[#001433]/55">{forPercent}% For</span>
                    <span className="text-sm font-semibold text-[#00205b] flex items-center transition-colors group-hover:text-[#ba0c2f]">
                      Les mer <ArrowRight className="ml-1 w-4 h-4" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </FadeIn>
  );
}
