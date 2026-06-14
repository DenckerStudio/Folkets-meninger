export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import LoginClient from './login-client';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[80vh] flex items-center justify-center text-gray-500">Laster…</div>}>
      <LoginClient />
    </Suspense>
  );
}
