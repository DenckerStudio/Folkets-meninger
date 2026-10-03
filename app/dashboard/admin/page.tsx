import { AdminHubGrid } from '@/components/admin/admin-shell';
import { PageHeader } from '@/components/page-header';

export default function AdminHubPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        as="h2"
        title="Oversikt"
        description="Velg et verktøy for å administrere Folkets Stemme."
      />
      <AdminHubGrid />
    </div>
  );
}
