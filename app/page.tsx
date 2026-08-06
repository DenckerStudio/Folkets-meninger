import FadeIn from '@/components/fade-in';
import HeroSection from '@/components/hero-section';
import { LandingHowItWorks } from '@/components/landing-how-it-works';
import { LandingPopularIssuesLazy } from '@/components/landing-popular-issues-lazy';
import CallToAction from '@/components/ui/call-to-action';
import { routes } from '@/lib/routes';

export default async function LandingPage() {
  return (
    <div className="space-y-28 pb-8">
      <HeroSection />

      <FadeIn delay={0.1} direction="up">
        <LandingHowItWorks />
      </FadeIn>

      <LandingPopularIssuesLazy />

      <FadeIn delay={0.2} direction="up">
        <CallToAction
          title="Klar til å delta?"
          subtitle="Opprett konto gratis og få tilgang til saker, stemmegivning, forum og høringer. Én person, én stemme — uavhengig av Regjeringen og Stortinget."
          primaryButtonText="Kom i gang"
          primaryButtonLink={routes.login}
          secondaryButtonText="Les mer om oss"
          secondaryButtonLink={routes.omOss}
        />
      </FadeIn>
    </div>
  );
}
