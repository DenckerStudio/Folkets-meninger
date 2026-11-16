import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { LandingResearchTopics } from '@/components/research-topics/landing-research-topics';
import { LandingSectionContainer } from '@/components/landing-section-container';
import { fetchLandingResearchTopics } from '@/lib/landing/home-data';
import { routes } from '@/lib/routes';

function LandingResearchTopicsError() {
  return (
    <LandingSectionContainer>
      <section
        className="rounded-3xl border border-dashed border-[#00205b]/20 bg-white px-6 py-10 text-center sm:px-10"
        role="status"
      >
        <p className="text-sm text-[#001433]/65">
          Temaoversikten er midlertidig utilgjengelig. Prøv igjen senere.
        </p>
        <Link
          href={routes.detteSnakkesDetOm}
          className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[#00205b] hover:text-[#ba0c2f]"
        >
          Gå til temaoversikten <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
        </Link>
      </section>
    </LandingSectionContainer>
  );
}

export async function LandingResearchTopicsSection() {
  const { topics, failed } = await fetchLandingResearchTopics(3);

  if (failed) {
    return <LandingResearchTopicsError />;
  }

  if (!topics.length) {
    return null;
  }

  return <LandingResearchTopics topics={topics} />;
}