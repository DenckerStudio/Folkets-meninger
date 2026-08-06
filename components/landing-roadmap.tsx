'use client';

import Link from 'next/link';
import { Timeline } from '@/components/ui/modern-timeline';
import { routes } from '@/lib/routes';

/** Landing roadmap via 21st.dev Modern Timeline — no card chrome. */
export function LandingRoadmap() {
  return (
    <div id="veien-videre" className="scroll-mt-28">
      <Timeline
        title="Veien videre"
        subtitle="Fra soft launch til lokal demokrati — slik bygger vi Folkets Stemme videre."
        items={[
          {
            category: 'Fase 1',
            date: 'Nå',
            title: 'Lansering',
            description:
              'Saker fra Stortinget, AI-forenkling, sikker stemmegivning, forum med reels og offentlige profiler.',
            status: 'completed',
          },
          {
            category: 'Fase 2',
            date: 'Pågår',
            title: 'Poeng og tillit',
            description:
              'Poeng belønner konstruktiv aktivitet. Pålitelige brukere kan foreslå reels; kuratorer publiserer fra godkjente kilder.',
            status: 'current',
            detail: (
              <p>
                Nivåer: Aktiv 250 · Pålitelig 750 · Kurator 2 000 · Veteran 5 000.{' '}
                <Link href={routes.login} className="font-semibold text-[#00205b] underline-offset-2 hover:text-[#ba0c2f] hover:underline">
                  Opprett konto
                </Link>
              </p>
            ),
          },
          {
            category: 'Fase 3',
            date: 'Senere',
            title: 'Valgløfter',
            description: 'Følge politikere og spore om valgløfter holdes over tid.',
            status: 'upcoming',
          },
          {
            category: 'Fase 4',
            date: 'Senere',
            title: 'Kommune og fylke',
            description:
              'Lokale saker fra kommunestyrer og fylkesting for mer lokal innflytelse.',
            status: 'upcoming',
          },
        ]}
      />
    </div>
  );
}
