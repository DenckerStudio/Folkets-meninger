import AdminForumReportsClient from './admin-forum-reports-client';
import { requireForumAdminPage } from '@/lib/forum/admin-gate';

export const dynamic = 'force-dynamic';

export default async function AdminForumReportsPage() {
  await requireForumAdminPage();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <AdminForumReportsClient />
    </div>
  );
}
