import { Suspense } from 'react';
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard';

export const dynamic = 'force-dynamic';

export default function OnboardingPage() {
  return (
    <div className="min-h-[80vh] py-8 sm:py-12">
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Laster
          </div>
        }
      >
        <OnboardingWizard />
      </Suspense>
    </div>
  );
}
