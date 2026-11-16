import { Suspense } from 'react';
import HeroSection from '@/components/hero-section';
import { LandingAccountDeletedNotice } from '@/components/landing-account-deleted-notice';
import { LandingExpiredLinkNotice } from '@/components/landing-expired-link-notice';
import { LandingAbout } from '@/components/landing-about';
import { LandingExperience } from '@/components/landing-experience';
import { LandingHowItWorks } from '@/components/landing-how-it-works';
import { LandingHvaErAnnerledes } from '@/components/landing-hva-er-annerledes';
import { LandingPopularIssuesSection } from '@/components/landing-popular-issues-section';
import { LandingResearchTopicsSection } from '@/components/research-topics/landing-research-topics-section';
import { LandingSectionContainer } from '@/components/landing-section-container';
import CallToAction from '@/components/ui/call-to-action';
import { routes } from '@/lib/routes';
import { JsonLd } from '@/components/blog/json-ld';
import { siteOrganizationJsonLd, siteWebSiteJsonLd } from '@/lib/blog/json-ld';
import { homepageMetadata } from '@/lib/seo/metadata';

export const metadata = homepageMetadata();

/** Forsiden: levende data med kort ISR — align med populære saker / temaer. */
export const revalidate = 300;

export default function LandingPage() {
  return (
    <LandingExperience>
      <JsonLd data={[siteOrganizationJsonLd(), siteWebSiteJsonLd()]} />
      <div className="bg-background pb-8">
        <Suspense fallback={null}>
          <LandingAccountDeletedNotice />
          <LandingExpiredLinkNotice />
        </Suspense>
        <Suspense fallback={null}>
          <HeroSection />
        </Suspense>
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
            <Suspense fallback={null}>
              <LandingResearchTopicsSection />
            </Suspense>
          </div>

          <div data-landing-section>
            <Suspense fallback={null}>
              <LandingPopularIssuesSection />
            </Suspense>
          </div>

          <div data-landing-section>
            <LandingSectionContainer>
              <CallToAction
                title="Vil du at stemmen din skal telle?"
                subtitle="Opprett gratis konto på ett minutt. Én person, én stemme — tallene vises bare samlet."
                primaryButtonText="Opprett konto"
                primaryButtonLink={routes.login}
                secondaryButtonText="Les om hvordan det fungerer"
                secondaryButtonLink={routes.omOss}
              />
            </LandingSectionContainer>
          </div>
        </div>
      </div>
    </LandingExperience>
  );
}