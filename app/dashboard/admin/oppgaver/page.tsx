import { Suspense } from 'react';
import Link from 'next/link';
import { requireAdminPage } from '@/lib/admin/gate';
import { isAdminLocalAiHubEnabled } from '@/lib/admin/local-ai-hub/flags';
import { loadLocalAiOverviewCached } from '@/lib/admin/local-ai-hub/overview-cache';
import { VURDER_FOCUS_RING } from '@/lib/admin/vurder-interaction-classes';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import AdminLocalAiHubClient, { LocalAiHubPageSkeleton } from './admin-local-ai-hub-client';
import AdminOppgaverClient, { OppgaverPageSkeleton } from './admin-oppgaver-client';

type PageProps = {
  searchParams: Promise<{ view?: string }>;
};

export default async function AdminOppgaverPage({ searchParams }: PageProps) {
  await requireAdminPage(routes.adminOppgaver);
  const sp = await searchParams;
  const showDevKanban = sp.view === 'kanban';

  if (isAdminLocalAiHubEnabled() && showDevKanban) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Du ser den gamle dev-task-kanbanen.{' '}
          <Link href={routes.adminOppgaver} className={cn('font-medium text-brand hover:underline', VURDER_FOCUS_RING)}>
            Gå tilbake til lokal-AI-oversikten
          </Link>
        </p>
        <Suspense fallback={<OppgaverPageSkeleton />}>
          <AdminOppgaverClient />
        </Suspense>
      </div>
    );
  }

  if (isAdminLocalAiHubEnabled()) {
    const { result: initial } = await loadLocalAiOverviewCached();
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