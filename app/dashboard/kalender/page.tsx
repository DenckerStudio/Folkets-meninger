import { headers } from 'next/headers';
import { DashboardPage } from '@/components/dashboard/dashboard-page';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PageHeader } from '@/components/page-header';
import HoringerKalender from '@/components/kalender/horinger-kalender';
import { hearingsToKalenderEvents, toKalenderEventDto } from '@/lib/kalender-events';
import { resolveKalenderSiteOrigin, STORTINGET_HORINGER_ICS_URL } from '@/lib/kalender-ics';
import { routes } from '@/lib/routes';
import { fetchStortingetHoringer } from '@/lib/stortinget-horinger';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Kalender | Folkets Stemme',
  description: 'Høringer og innspillsfrister fra Stortinget i kalendervisning.',
};

async function resolveRequestOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host');
  const proto = headerList.get('x-forwarded-proto') ?? 'https';
  if (host) return `${proto}://${host}`;
  return resolveKalenderSiteOrigin();
}

export default async function KalenderPage() {
  let events: ReturnType<typeof toKalenderEventDto>[] = [];
  try {
    const hearings = await fetchStortingetHoringer();
    events = hearingsToKalenderEvents(hearings).map(toKalenderEventDto);
  } catch (error) {
    console.error('Error fetching calendar hearings:', error);
  }

  const origin = await resolveRequestOrigin();
  const icsHttpsUrl = `${origin}${routes.horingerIcs}`;
  const webcalUrl = icsHttpsUrl.replace(/^https:/, 'webcal:').replace(/^http:/, 'webcal:');

  return (
    <DashboardPage>
      <PageHeader
        title="Kalender"
        description="Høringer og innspillsfrister. Abonner, eller bla måned for måned."
      />

      {events.length === 0 ? (
        <EmptyState
          title="Klarte ikke å hente høringer"
          description="Prøv igjen senere. Kilden er Stortingets åpne data."
          tone="error"
        />
      ) : (
        <HoringerKalender
          events={events}
          icsHttpsUrl={icsHttpsUrl}
          webcalUrl={webcalUrl}
          stortingetIcsUrl={STORTINGET_HORINGER_ICS_URL}
        />
      )}

      <p className="text-xs text-muted-foreground">
        Kilde:{' '}
        <a
          href="https://data.stortinget.no/"
          className="underline hover:text-foreground"
        >
          Stortinget åpne data
        </a>
        .
      </p>
    </DashboardPage>
  );
}
