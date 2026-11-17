import { Suspense } from 'react';
import { requireAdminPage } from '@/lib/admin/gate';
import { isAdminLocalAiHubEnabled } from '@/lib/admin/local-ai-hub/flags';
import { loadLocalAiOverview } from '@/lib/admin/local-ai-hub/overview';
import { routes } from '@/lib/routes';
import AdminLocalAiHubClient, { LocalAiHubPageSkeleton } from './admin-local-ai-hub-client';
import AdminOppgaverClient, { OppgaverPageSkeleton } from './admin-oppgaver-client';

export default async function AdminOppgaverPage() {
  await requireAdminPage(routes.adminOppgaver);

  if (isAdminLocalAiHubEnabled()) {
    const initial = await loadLocalAiOverview();
    return (
      <Suspense fallback={<LocalAiHubPageSkeleton />}>
        <AdminLocalAiHubClient initial={initial} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<OppgaverPageSkeleton />}>
      <AdminOppgaverClient />
    </Suspense>
  );
}
