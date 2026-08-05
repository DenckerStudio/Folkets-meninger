import FadeIn from '@/components/fade-in';
import { PageHeader } from '@/components/page-header';
import { getSaksganger } from '@/lib/stortinget';

export const revalidate = 86400;

export default async function SaksgangerPage() {
  const saksganger = await getSaksganger();
  const sorted = [...saksganger].sort((a, b) => a.navn.localeCompare(b.navn, 'no'));

  return (
    <div className="space-y-8 pb-12">
      <FadeIn delay={0.1}>
        <div className="bg-card rounded-[2.5rem] shadow-sm border border-border p-8 md:p-12">
          <PageHeader
            title="Saksganger"
            description="Oversikt over saksganger (aktivt og historisk). Brukes også i sak-detaljer under saksgang."
          />
        </div>
      </FadeIn>

      <FadeIn delay={0.2} direction="up">
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
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
            {sorted.length === 0 && <div className="px-6 py-10 text-sm text-muted-foreground">Ingen data.</div>}
          </div>
        </div>
      </FadeIn>
    </div>
  );
}

