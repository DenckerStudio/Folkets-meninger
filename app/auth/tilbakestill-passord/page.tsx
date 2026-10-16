export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ResetPasswordClient } from './reset-password-client';

export const metadata: Metadata = {
  title: 'Nytt passord',
  robots: { index: false, follow: false },
};

export default function TilbakestillPassordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[80vh] items-center justify-center text-muted-foreground">Laster …</div>
      }
    >
      <ResetPasswordClient />
    </Suspense>
  );
}
