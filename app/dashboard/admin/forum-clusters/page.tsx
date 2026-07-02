import { redirect } from 'next/navigation';
import { requireForumAdminPage } from '@/lib/forum/admin-gate';
import { routes } from '@/lib/routes';

export default async function AdminForumClustersPage() {
  await requireForumAdminPage();
  redirect(`${routes.adminForumPrompts}?tab=pipeline`);
}
