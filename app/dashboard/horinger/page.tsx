import Link from 'next/link';
import { Calendar } from 'lucide-react';
import { fetchStortingetHoringer, sortHoringer, summarizeHoringer } from '@/lib/stortinget-horinger';
import HoringerList from '@/components/horinger/horinger-list';
import { PageHeader } from '@/components/page-header';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

export default async function HoringerPage() {
  let hearings: Awaited<ReturnType<typeof fetchStortingetHoringer>> = [];
  try {
    hearings = await fetchStortingetHoringer();
  } catch (error) {
    console.error('Error fetching horinger:', error);
  }

  const stats = summarizeHoringer(hearings);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title="Høringer"
          description={
            stats.open > 0
              ? `${stats.open} høringer er åpne for innspill nå. Søk, filtrer og del din mening — eller les hva andre mener.`
              : 'Se planlagte og avholdte høringer fra Stortinget. Søk, filtrer og følg med på demokratiet.'
          }
        />
        <Link
          href={routes.kalender}
          className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-brand hover:underline"
        >
          <Calendar className="h-4 w-4" aria-hidden />
          Se i kalender
        </Link>
      </div>

      {hearings.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground rounded-2xl border border-dashed border-border">
          Klarte ikke å hente høringer. Prøv igjen senere.
        </div>
      ) : (
        <HoringerList hearings={sortHoringer(hearings)} />
      )}
    </div>
  );
}
