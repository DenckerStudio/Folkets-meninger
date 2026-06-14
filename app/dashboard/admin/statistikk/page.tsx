import AdminStatistikkClient from './admin-statistikk-client';
import { requireForumAdminPage } from '@/lib/forum/admin-gate';

export const dynamic = 'force-dynamic';

export default async function AdminStatistikkPage() {
  await requireForumAdminPage();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <AdminStatistikkClient />
    </div>
  );
}
