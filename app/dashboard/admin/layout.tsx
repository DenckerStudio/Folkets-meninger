import { requireAdminPage } from '@/lib/admin/gate';
import { AdminShell } from '@/components/admin/admin-shell';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();

  return <AdminShell>{children}</AdminShell>;
}
