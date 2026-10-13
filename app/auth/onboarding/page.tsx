import { Suspense } from 'react';
import { OnboardingForm } from './onboarding-form';

export const metadata = {
  title: 'Kom i gang | Folkets Meninger',
  description: 'Velg hjertesaker og fylke, og ta en kort omvisning i Folkets Meninger.',
};

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
          Laster…
        </div>
      }
    >
      <OnboardingForm />
    </Suspense>
  );
}
