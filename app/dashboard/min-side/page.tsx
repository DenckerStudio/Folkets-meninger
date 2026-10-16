import { Suspense } from 'react';
import { ProfileShell } from '@/components/profile/profile-shell';
import { isStripeCheckoutConfigured } from '@/lib/stripe/config';

export default async function MinSidePage() {
  const checkoutConfigured = isStripeCheckoutConfigured();

  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Laster…</div>}>
      <ProfileShell stemmePlusCheckoutConfigured={checkoutConfigured} />
    </Suspense>
  );
}
