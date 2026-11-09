import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import FadeIn from '@/components/fade-in';
import { LandingSectionContainer } from '@/components/landing-section-container';
import { LandingHeadingRule } from '@/components/icons/civic';
import { PublicResearchTopicCard } from '@/components/research-topics/public-research-topic-card';
import type { PublicResearchTopicListItem } from '@/lib/research-topics/public-map';
import { routes } from '@/lib/routes';

type LandingResearchTopicsProps = {
  topics: PublicResearchTopicListItem[];
};

export function LandingResearchTopics({ topics }: LandingResearchTopicsProps) {
  return (
    <FadeIn delay={0.18} direction="up">
      <LandingSectionContainer>
        <section>
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#ba0c2f]">
                Samfunnsdebatt
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-[#001433] sm:text-4xl">
                Dette snakkes det om
              </h2>
              <LandingHeadingRule />
              <p className="mt-2 max-w-xl text-[#001433]/65">
                Korte oversikter over temaer som er kartlagt ut fra offentlige kilder.
              </p>
            </div>
            <Link
              href={routes.detteSnakkesDetOm}
              className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-[#00205b] transition-colors hover:text-[#ba0c2f]"
            >
              Se alle temaer <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 items-stretch">
            {topics.map((topic) => (
              <PublicResearchTopicCard key={topic.id} topic={topic} />
            ))}
          </div>
        </section>
      </LandingSectionContainer>
    </FadeIn>
  );
}
