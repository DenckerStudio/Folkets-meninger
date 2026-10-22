import { Suspense } from 'react';
import { requireAdminPage } from '@/lib/admin/gate';
import { routes } from '@/lib/routes';
import AdminVurderClient, { VurderPageSkeleton } from './admin-vurder-client';

export default async function AdminVurderPage() {
  await requireAdminPage(routes.adminVurder);
  return (
    <Suspense fallback={<VurderPageSkeleton />}>
      <AdminVurderClient />
    </Suspense>
  );
}
