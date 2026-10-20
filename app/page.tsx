import HeroSection from '@/components/hero-section';
import { LandingAbout } from '@/components/landing-about';
import { LandingExperience } from '@/components/landing-experience';
import { LandingHowItWorks } from '@/components/landing-how-it-works';
import { LandingHvaErAnnerledes } from '@/components/landing-hva-er-annerledes';
import { LandingPopularIssuesLazy } from '@/components/landing-popular-issues-lazy';
import { LandingSectionContainer } from '@/components/landing-section-container';
import CallToAction from '@/components/ui/call-to-action';
import { routes } from '@/lib/routes';
import { JsonLd } from '@/components/blog/json-ld';
import { siteOrganizationJsonLd, siteWebSiteJsonLd } from '@/lib/blog/json-ld';
import { homepageMetadata } from '@/lib/seo/metadata';

export const metadata = homepageMetadata();

export default function LandingPage() {
  return (
    <LandingExperience>
      <JsonLd data={[siteOrganizationJsonLd(), siteWebSiteJsonLd()]} />
      <div className="bg-background pb-8">
        <HeroSection />
        <div data-landing-section>
          <LandingHowItWorks />
        </div>

        <div className="mt-28 flex flex-col gap-28">
          <div data-landing-section>
            <LandingAbout />
          </div>

          <div data-landing-section>
            <LandingHvaErAnnerledes />
          </div>

          <div data-landing-section>
            <LandingPopularIssuesLazy />
          </div>

          <div data-landing-section>
            <LandingSectionContainer>
              <CallToAction
                title="Klar til å delta?"
                subtitle="Opprett konto gratis. Én person, én stemme."
                primaryButtonText="Kom i gang"
                primaryButtonLink={routes.login}
                secondaryButtonText="Gi innspill"
                secondaryButtonLink={routes.innspill}
              />
            </LandingSectionContainer>
          </div>
        </div>
      </div>
    </LandingExperience>
  );
}
