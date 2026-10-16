import Link from 'next/link';
import { Calendar } from 'lucide-react';
import { fetchStortingetHoringer, sortHoringer, summarizeHoringer } from '@/lib/stortinget-horinger';
import { DashboardPage } from '@/components/dashboard/dashboard-page';
import { EmptyState } from '@/components/dashboard/empty-state';
import HoringerList from '@/components/horinger/horinger-list';
import { PageHeader } from '@/components/page-header';
import { routes } from '@/lib/routes';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata = buildPageMetadata({
  title: 'Høringer',
  description:
    'Åpne og planlagte høringer fra Stortinget. Søk, filtrer og send innspill til saker under behandling.',
  canonicalPath: '/dashboard/horinger',
});

export default async function HoringerPage() {
  let hearings: Awaited<ReturnType<typeof fetchStortingetHoringer>> = [];
  try {
    hearings = await fetchStortingetHoringer();
  } catch (error) {
    console.error('Error fetching horinger:', error);
  }

  const stats = summarizeHoringer(hearings);

  return (
    <DashboardPage>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title="Høringer"
          description={
            stats.open > 0
              ? `${stats.open} åpne for innspill. Søk, filtrer eller del din mening.`
              : 'Planlagte og avholdte høringer fra Stortinget.'
          }
        />
        <Link
          href={routes.kalender}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-lg border border-border px-4 text-sm font-medium text-brand hover:bg-muted sm:self-auto"
        >
          <Calendar className="h-4 w-4" aria-hidden />
          Se i kalender
        </Link>
      </div>

      {hearings.length === 0 ? (
        <EmptyState
          title="Klarte ikke å hente høringer"
          description="Stortingets åpne data svarer ikke akkurat nå. Prøv igjen om litt."
          tone="error"
        />
      ) : (
        <HoringerList hearings={sortHoringer(hearings)} />
      )}
    </DashboardPage>
  );
}
