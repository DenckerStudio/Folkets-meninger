export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { Suspense } from 'react';
import LoginClient from './login-client';

export const metadata: Metadata = {
  title: 'Logg inn',
  description: 'Logg inn med e-post eller Google for å stemme og delta i Folkets Meninger.',
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[80vh] flex items-center justify-center text-muted-foreground">Laster…</div>}>
      <LoginClient />
    </Suspense>
  );
}
