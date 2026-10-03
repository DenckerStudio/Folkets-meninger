import HeroSection from '@/components/hero-section';
import { LandingAbout } from '@/components/landing-about';
import { LandingExperience } from '@/components/landing-experience';
import { LandingHowItWorks } from '@/components/landing-how-it-works';
import { LandingPopularIssuesLazy } from '@/components/landing-popular-issues-lazy';
import { LandingRoadmap } from '@/components/landing-roadmap';
import CallToAction from '@/components/ui/call-to-action';
import { listAppRoadmapItems } from '@/lib/admin/app-future';
import { routes } from '@/lib/routes';

export default async function LandingPage() {
  let roadmap = [] as Awaited<ReturnType<typeof listAppRoadmapItems>>;
  try {
    roadmap = await listAppRoadmapItems();
  } catch {
    roadmap = [];
  }

  return (
    <LandingExperience>
      <div className="space-y-28 pb-8">
        <HeroSection />

        <div data-landing-section>
          <LandingHowItWorks />
        </div>

        <div data-landing-section>
          <LandingAbout />
        </div>

        <div data-landing-section>
          <LandingPopularIssuesLazy />
        </div>

        <div data-landing-section>
          <LandingRoadmap items={roadmap} />
        </div>

        <div data-landing-section>
          <CallToAction
            title="Klar til å delta?"
            subtitle="Opprett konto gratis. Én person, én stemme."
            primaryButtonText="Kom i gang"
            primaryButtonLink={routes.login}
            secondaryButtonText="Gi innspill"
            secondaryButtonLink={routes.innspill}
          />
        </div>
      </div>
    </LandingExperience>
  );
}
