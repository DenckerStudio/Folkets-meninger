'use client';

import Link from 'next/link';
import { Timeline } from '@/components/ui/modern-timeline';
import { routes } from '@/lib/routes';

/**
 * Landing roadmap — statuses mirror what is actually shipped in the app today
 * (see AGENTS.md / dashboard routes), plus near-term UX priorities from product review.
 */
export function LandingRoadmap() {
  return (
    <div id="veien-videre" className="scroll-mt-28">
      <Timeline
        title="Veien videre"
        subtitle="Slik står plattformen i dag — og hva vi prioriterer for å gjøre det enklere å forstå, stemme og følge med."
        items={[
          {
            category: 'Fase 1',
            date: 'Soft launch',
            title: 'Kjerneplattformen er live',
            description:
              'Saker og dokumenter fra Stortinget, AI-sammendrag, ja/nei-stemming med lukkevindu, forum med moderering, høringer med lokale innspill, politikeroversikt, varsler og offentlige sak-/politiker-sider.',
            status: 'completed',
            detail: (
              <p>
                Du kan også sende{' '}
                <Link
                  href={routes.innspill}
                  className="font-semibold text-[#00205b] underline-offset-2 hover:text-[#ba0c2f] hover:underline"
                >
                  innspill
                </Link>{' '}
                direkte fra nettsiden.
              </p>
            ),
          },
          {
            category: 'Fase 2',
            date: 'Nå',
            title: 'Tillit, synlighet og førsteinntrykk',
            description:
              'Poengnivåer (Aktiv → Veteran) finnes allerede. Innlogging lander på utforsk for første stemme, populære saker er synlige før login, og forum-reels åpnes når nok aktive grounded prompts er publisert. MinID forberedes.',
            status: 'current',
            detail: (
              <p>
                Nivåer i bruk: Aktiv 250 · Pålitelig 750 · Kurator 2 000 · Veteran 5 000.{' '}
                <Link
                  href={`${routes.login}?next=${encodeURIComponent(routes.utforsk)}`}
                  className="font-semibold text-[#00205b] underline-offset-2 hover:text-[#ba0c2f] hover:underline"
                >
                  Opprett konto og stem
                </Link>
              </p>
            ),
          },
          {
            category: 'Fase 3',
            date: 'Neste',
            title: 'Dypere politisk innsikt',
            description:
              'Valgomat med parti-sammenligning (når Stortingets stemmedata per parti er tilgjengelig), sporing av valgløfter, rikere politiker-hub og åpen innsikt når nok anonyme stemmer er samlet.',
            status: 'upcoming',
          },
          {
            category: 'Fase 4',
            date: 'Senere',
            title: 'Nærmere deg — kommune og fylke',
            description:
              'Lokale saker fra kommunestyrer og fylkesting, slik at den samme stemmen også gjelder der beslutningene treffer hverdagen hardest.',
            status: 'upcoming',
          },
        ]}
      />
    </div>
  );
}
