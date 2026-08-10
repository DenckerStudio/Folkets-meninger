import AdminStatistikkClient from './admin-statistikk-client';
import { requireAdminPage } from '@/lib/admin/gate';

export const dynamic = 'force-dynamic';

export default async function AdminStatistikkPage() {
  await requireAdminPage();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <AdminStatistikkClient />
    </div>
  );
}
