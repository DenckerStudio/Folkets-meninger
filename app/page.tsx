import HeroSection from '@/components/hero-section';
import { LandingAbout } from '@/components/landing-about';
import { LandingExperience } from '@/components/landing-experience';
import { LandingHowItWorks } from '@/components/landing-how-it-works';
import { LandingPopularIssuesLazy } from '@/components/landing-popular-issues-lazy';
import { LandingSectionContainer } from '@/components/landing-section-container';
import CallToAction from '@/components/ui/call-to-action';
import { routes } from '@/lib/routes';
import { homepageMetadata } from '@/lib/seo/metadata';

export const metadata = homepageMetadata();

export default function LandingPage() {
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
          <LandingSectionContainer>
            <CallToAction
              title="Vil du være med?"
              subtitle="Opprett konto gratis. Én person, én stemme."
              primaryButtonText="Kom i gang"
              primaryButtonLink={routes.login}
              secondaryButtonText="Gi innspill"
              secondaryButtonLink={routes.innspill}
            />
          </LandingSectionContainer>
        </div>
      </div>
    </LandingExperience>
  );
}
