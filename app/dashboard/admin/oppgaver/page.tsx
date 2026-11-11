import { Suspense } from 'react';
import { requireAdminPage } from '@/lib/admin/gate';
import { routes } from '@/lib/routes';
import AdminOppgaverClient, { OppgaverPageSkeleton } from './admin-oppgaver-client';

export default async function AdminOppgaverPage() {
  await requireAdminPage(routes.adminOppgaver);
  return (
    <Suspense fallback={<OppgaverPageSkeleton />}>
      <AdminOppgaverClient />
    </Suspense>
  );
}
