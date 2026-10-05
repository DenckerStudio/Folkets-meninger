import { DashboardPage } from '@/components/dashboard/dashboard-page';
import { EmptyState } from '@/components/dashboard/empty-state';
import { SurfaceCard } from '@/components/dashboard/surface-card';
import FadeIn from '@/components/fade-in';
import { PageHeader } from '@/components/page-header';
import Image from 'next/image';
import { STORTINGET_ACTIVE_PERIODE_ID } from '@/lib/stortinget-config';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

type ApiResponse = {
  periode: string;
  representanter: Array<{
    id: string;
    fornavn: string;
    etternavn: string;
    fylke?: { navn?: string };
    parti?: { navn?: string; id?: string };
  }>;
};

export default async function RepresentanterPage() {
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host');
  const proto = h.get('x-forwarded-proto') || 'http';
  const baseUrl = host ? `${proto}://${host}` : '';

  const res = await fetch(`${baseUrl}/api/representanter?periode=${encodeURIComponent(STORTINGET_ACTIVE_PERIODE_ID)}`, {
    cache: 'no-store',
  });

  const data = (res.ok ? ((await res.json()) as ApiResponse) : null) ?? {
    periode: STORTINGET_ACTIVE_PERIODE_ID,
    representanter: [],
  };

  const sorted = [...data.representanter].sort((a, b) => a.etternavn.localeCompare(b.etternavn, 'no'));

  return (
    <DashboardPage>
      <FadeIn delay={0.1}>
        <PageHeader
          title="Representanter"
          description={`Innvalgte representanter for stortingsperioden ${data.periode}.`}
        />
      </FadeIn>

      <FadeIn delay={0.2} direction="up">
        {sorted.length === 0 ? (
          <EmptyState
            title="Ingen representanter funnet"
            description="Klarte ikke å hente listen. Prøv igjen senere."
            tone="error"
          />
        ) : (
          <SurfaceCard padded={false} className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="text-sm text-muted-foreground">{sorted.length} representanter</div>
            </div>
            <div className="divide-y divide-border">
              {sorted.map((r) => (
                <div key={r.id} className="flex items-center gap-4 px-6 py-4">
                  <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-muted">
                    <Image
                      src={`https://data.stortinget.no/eksport/personbilde?personid=${encodeURIComponent(r.id)}&storrelse=lite&erstatningsbilde=true`}
                      alt={`${r.fornavn} ${r.etternavn}`}
                      fill
                      className="object-cover"
                      sizes="40px"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-foreground">
                      {r.fornavn} {r.etternavn}
                    </div>
                    <div className="truncate text-sm text-muted-foreground">
                      {r.parti?.navn || 'Ukjent parti'} · {r.fylke?.navn || 'Ukjent fylke'}
                    </div>
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">{r.id}</div>
                </div>
              ))}
            </div>
          </SurfaceCard>
        )}
      </FadeIn>
    </DashboardPage>
  );
}

