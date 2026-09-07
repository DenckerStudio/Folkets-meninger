import { AdminHubGrid } from '@/components/admin/admin-shell';

export default function AdminHubPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Oversikt</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Velg et verktøy for å administrere Folkets Stemme.
        </p>
      </div>
      <AdminHubGrid />
    </div>
  );
}
