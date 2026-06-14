import AdminForumPromptsClient from './admin-forum-prompts-client';
import { requireForumAdminPage } from '@/lib/forum/admin-gate';

export const dynamic = 'force-dynamic';

export default async function AdminForumPromptsPage() {
  await requireForumAdminPage();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <AdminForumPromptsClient />
    </div>
  );
}
