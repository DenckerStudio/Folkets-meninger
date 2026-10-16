import { TrustDocLayout } from '@/components/trust/trust-doc-layout';
import {
  TRUST_ANALYTICS_NOTE,
  TRUST_COOLIFY_STACK,
  TRUST_HOSTING_SUMMARY,
  TRUST_THIRD_PARTY_PROVIDERS,
  TRUST_VERCEL_NOTE,
} from '@/lib/trust/subprocessors';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { routes } from '@/lib/routes';
import Link from 'next/link';
import type { SubprocessorRow } from '@/lib/trust/subprocessors';

export const metadata = buildPageMetadata({
  title: 'Personvern og infrastruktur',
  description:
    'Hvor appen og data driftes (Norge), og hvilke tredjepartsleverandører som brukes ved betaling, innlogging og domene.',
  canonicalPath: routes.personvern,
});

function SubprocessorList({ rows }: { rows: SubprocessorRow[] }) {
  return (
    <ul className="mt-4 space-y-4">
      {rows.map((row) => (
        <li
          key={row.name}
          className="rounded-xl border border-[#00205b]/10 bg-white p-4 shadow-sm"
        >
          <h3 className="font-semibold text-[#001433]">{row.name}</h3>
          <p className="mt-1 text-sm">
            <span className="font-medium">Formål:</span> {row.purpose}
          </p>
          <p className="mt-1 text-sm">
            <span className="font-medium">Hosting:</span> {row.hosting}
          </p>
        </li>
      ))}
    </ul>
  );
}

export default function PersonvernPage() {
  return (
    <TrustDocLayout
      title="Personvern og infrastruktur"
      description="Presis oversikt over egen drift i Norge og tredjeparter — uten å skjule hva som skjer utenfor serveren."
    >
      <section className="rounded-2xl border border-[#00205b]/12 bg-[#00205b]/[0.03] p-5 text-sm leading-relaxed">
        <p className="font-semibold text-[#001433]">Egen drift</p>
        <p className="mt-2 text-base font-medium text-[#001433]">{TRUST_HOSTING_SUMMARY}</p>
        <p className="mt-2">
          Vi samarbeider ikke med Regjeringen eller Stortinget. Stemmer og holdninger lagres i databasen
          på vår server. Stortingets åpne data hentes kun som lesbar kilde.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-[#001433]">På server i Norge (Coolify)</h2>
        <p className="mt-2 text-sm">
          Disse komponentene kjører self-hosted på samme norske serverstack, verifisert fra miljøvariabler,
          API-ruter og n8n-workflows i dette repoet.
        </p>
        <SubprocessorList rows={TRUST_COOLIFY_STACK} />
      </section>

      <section>
        <h2 className="text-xl font-bold text-[#001433]">Tredjepartsleverandører</h2>
        <p className="mt-2 text-sm">
          Betaling, innlogging, domene og valgfrie bruker-valgte tjenester kan behandle data utenfor
          Norge selv om appen driftes her.
        </p>
        <SubprocessorList rows={TRUST_THIRD_PARTY_PROVIDERS} />
      </section>

      <section>
        <h2 className="text-xl font-bold text-[#001433]">Analytics og Vercel</h2>
        <p className="mt-2 text-sm">{TRUST_ANALYTICS_NOTE}</p>
        <p className="mt-3 text-sm">{TRUST_VERCEL_NOTE}</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-[#001433]">Dine rettigheter</h2>
        <p className="mt-2 text-sm">
          Du kan be om innsyn og sletting via{' '}
          <Link href={routes.innspill} className="font-medium text-[#00205b] underline-offset-2 hover:underline">
            innspill-skjemaet
          </Link>{' '}
          eller e-post til kontakt@folkets-meninger.no. Offentlig aktivitet er opt-in i profilen.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-[#001433]">Mer om AI</h2>
        <p className="mt-2 text-sm">
          Se{' '}
          <Link href={routes.omAi} className="font-medium text-[#00205b] underline-offset-2 hover:underline">
            AI og modeller
          </Link>{' '}
          for hvilke modeller som brukes til sammendrag og poll-utkast.
        </p>
      </section>
    </TrustDocLayout>
  );
}
