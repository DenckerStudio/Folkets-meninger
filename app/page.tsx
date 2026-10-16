import HeroSection from '@/components/hero-section';
import { LandingAbout } from '@/components/landing-about';
import { LandingExperience } from '@/components/landing-experience';
import { LandingHowItWorks } from '@/components/landing-how-it-works';
import { LandingPopularIssuesLazy } from '@/components/landing-popular-issues-lazy';
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

        <div data-landing-section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <LandingAbout />
        </div>

        <div data-landing-section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <LandingPopularIssuesLazy />
        </div>

        <div data-landing-section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
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
