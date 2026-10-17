import { LandingSectionContainer } from '@/components/landing-section-container';
import HowItWorks from '@/components/ui/how-it-works';

/** Landing “Slik fungerer det” — same base background as hero (no separate grey wash). */
export function LandingHowItWorks() {
  return (
    <section className="relative w-full bg-background">
      <LandingSectionContainer className="relative z-10">
        <HowItWorks className="px-0 pt-8 sm:px-0 sm:pt-10 md:pt-12" />
      </LandingSectionContainer>
    </section>
  );
}
