import { requireAdminPage } from '@/lib/admin/gate';
import { routes } from '@/lib/routes';
import AdminBrukereClient from './admin-brukere-client';

export const dynamic = 'force-dynamic';

export default async function AdminBrukerePage() {
  await requireAdminPage(routes.adminBrukere);
  return <AdminBrukereClient />;
}
