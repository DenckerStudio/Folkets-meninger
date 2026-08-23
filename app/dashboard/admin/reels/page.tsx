import { requireAdminPage } from '@/lib/admin/gate';
import { routes } from '@/lib/routes';
import AdminReelsClient from './admin-reels-client';

export const dynamic = 'force-dynamic';

export default async function AdminReelsPage() {
  await requireAdminPage(routes.adminReels);
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <AdminReelsClient />
    </div>
  );
}
