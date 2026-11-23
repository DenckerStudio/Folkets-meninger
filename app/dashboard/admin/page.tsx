import { AdminHubGrid } from '@/components/admin/admin-shell';
import { PageHeader } from '@/components/page-header';
import { requireAdminPage } from '@/lib/admin/gate';
import { routes } from '@/lib/routes';

export default async function AdminHubPage() {
  await requireAdminPage(routes.admin);
  return (
    <div className="space-y-4">
      <PageHeader
        as="h2"
        title="Oversikt"
        description="Velg et verktøy for å administrere Folkets Meninger."
      />
      <AdminHubGrid />
    </div>
  );
}
