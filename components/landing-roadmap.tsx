'use client';

import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { RoadmapCard } from '@/components/ui/roadmap-card';
import { routes } from '@/lib/routes';

/** Landing roadmap (“Veien videre”) using 21st.dev RoadmapCard. */
export function LandingRoadmap() {
  return (
    <div id="veien-videre" className="scroll-mt-28">
      <RoadmapCard
        title="Veien videre"
        subtitle="Fra soft launch til lokal demokrati — slik bygger vi Folkets Stemme videre."
        items={[
          {
            quarter: 'Fase 1',
            title: 'Lansering',
            description:
              'Saker fra Stortinget, AI-forenkling, sikker stemmegivning, forum med reels og offentlige profiler.',
            status: 'done',
          },
          {
            quarter: 'Fase 2',
            title: 'Poeng og tillit',
            description:
              'Poeng belønner konstruktiv aktivitet. Pålitelige brukere kan foreslå reels; kuratorer publiserer fra godkjente kilder.',
            status: 'in-progress',
            children: (
              <div className="rounded-2xl border border-[#00205b]/12 bg-[#00205b]/[0.03] p-5">
                <div className="flex items-center gap-2 font-semibold text-[#00205b]">
                  <Trophy className="h-4 w-4 text-[#ba0c2f]" aria-hidden />
                  Poengnivåer
                </div>
                <ul className="mt-3 space-y-2 text-sm text-[#001433]/70">
                  <li>
                    <strong className="text-[#001433]">Aktiv (250):</strong> Synlig merke som
                    bidragsyter.
                  </li>
                  <li>
                    <strong className="text-[#001433]">Pålitelig (750):</strong> Foreslå forum-reels.
                  </li>
                  <li>
                    <strong className="text-[#001433]">Kurator (2 000):</strong> Publiser fra
                    godkjente kilder.
                  </li>
                  <li>
                    <strong className="text-[#001433]">Veteran (5 000):</strong> Foreslå nye kilder.
                  </li>
                </ul>
                <Link
                  href={routes.login}
                  className="mt-4 inline-flex items-center rounded-full bg-[#00205b] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#ba0c2f]"
                >
                  Opprett konto
                </Link>
              </div>
            ),
          },
          {
            quarter: 'Fase 3',
            title: 'Valgløfter',
            description: 'Følge politikere og spore om valgløfter holdes over tid.',
            status: 'upcoming',
          },
          {
            quarter: 'Fase 4',
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
