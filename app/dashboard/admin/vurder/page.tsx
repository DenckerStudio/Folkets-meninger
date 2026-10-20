import { requireAdminPage } from '@/lib/admin/gate';
import { routes } from '@/lib/routes';
import AdminVurderClient from './admin-vurder-client';

export default async function AdminVurderPage() {
  await requireAdminPage(routes.adminVurder);
  return <AdminVurderClient />;
}
