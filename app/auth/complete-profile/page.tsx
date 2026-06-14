import { Suspense } from 'react';
import CompleteProfileClient from './complete-profile-client';

export const dynamic = 'force-dynamic';

export default function CompleteProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center text-gray-500">Laster…</div>}>
      <CompleteProfileClient />
    </Suspense>
  );
}
