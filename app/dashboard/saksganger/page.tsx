import { DashboardPage } from '@/components/dashboard/dashboard-page';
import { EmptyState } from '@/components/dashboard/empty-state';
import { SurfaceCard } from '@/components/dashboard/surface-card';
import FadeIn from '@/components/fade-in';
import { PageHeader } from '@/components/page-header';
import { getSaksganger } from '@/lib/stortinget';

export const revalidate = 86400;

export default async function SaksgangerPage() {
  const saksganger = await getSaksganger();
  const sorted = [...saksganger].sort((a, b) => a.navn.localeCompare(b.navn, 'no'));

  return (
    <DashboardPage>
      <FadeIn delay={0.1}>
        <PageHeader
          title="Saksganger"
          description="Oversikt over saksganger (aktivt og historisk). Brukes også i sak-detaljer under saksgang."
        />
      </FadeIn>

      <FadeIn delay={0.2} direction="up">
        {sorted.length === 0 ? (
          <EmptyState title="Ingen saksganger" description="Klarte ikke å hente data fra Stortinget." tone="error" />
        ) : (
        <SurfaceCard padded={false} className="overflow-hidden">
          <div className="px-6 py-4 border-b border-border text-sm text-muted-foreground">{sorted.length} saksganger</div>
          <div className="divide-y divide-border">
            {sorted.map((sg) => (
              <div key={sg.id} className="px-6 py-4">
                <div className="flex items-baseline justify-between gap-4">
                  <div className="font-semibold text-foreground">{sg.navn}</div>
                  <div className="text-xs text-muted-foreground font-mono">{sg.id}</div>
                </div>
                {sg.saksgang_steg_liste?.length ? (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {[...sg.saksgang_steg_liste]
                      .sort((a, b) => (a.steg_nummer ?? 0) - (b.steg_nummer ?? 0))
                      .map((steg) => (
                        <div key={steg.id} className="rounded-xl border border-border bg-muted/40 px-3 py-2">
                          <div className="text-sm font-semibold text-foreground">{steg.navn}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            <span className="font-mono">{steg.id}</span>
                            {steg.steg_nummer != null && <span className="ml-2">#{steg.steg_nummer}</span>}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-muted-foreground">Ingen steg.</div>
                )}
              </div>
            ))}
          </div>
        </SurfaceCard>
        )}
      </FadeIn>
    </DashboardPage>
  );
}

