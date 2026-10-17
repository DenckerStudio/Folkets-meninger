import Link from 'next/link';
import { TrustDocLayout } from '@/components/trust/trust-doc-layout';
import {
  TRUST_ANALYTICS_NOTE,
  TRUST_COOLIFY_STACK,
  TRUST_HOSTING_SUMMARY,
  TRUST_THIRD_PARTY_PROVIDERS,
  TRUST_VERCEL_NOTE,
} from '@/lib/trust/subprocessors';
import {
  DATA_CONTROLLER,
  formatDataControllerBlock,
} from '@/lib/legal/controller';
import {
  PRIVACY_AGE,
  PRIVACY_COMPLAINT,
  PRIVACY_COOKIES,
  PRIVACY_NOTICE_UPDATED,
  PRIVACY_PROCESSING_TABLE,
  PRIVACY_RECIPIENTS_INTRO,
  PRIVACY_RIGHTS,
  PRIVACY_TRANSFERS,
} from '@/lib/legal/privacy-notice-content';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { routes } from '@/lib/routes';
import type { SubprocessorRow } from '@/lib/trust/subprocessors';

export const metadata = buildPageMetadata({
  title: 'Personvernerklæring',
  description:
    'Personvernerklæring for Folkets Meninger: formål, rettslig grunnlag, lagring, underleverandører og dine rettigheter.',
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
  const controllerBlock = formatDataControllerBlock();

  return (
    <TrustDocLayout
      title="Personvernerklæring"
      description={`Sist oppdatert: ${PRIVACY_NOTICE_UPDATED}. Les om hvordan vi behandler personopplysninger i Folkets Meninger.`}
    >
      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="text-xl font-bold text-[#001433]">1. Hvem er ansvarlig?</h2>
        {controllerBlock ? (
          <p>{controllerBlock} er behandlingsansvarlig.</p>
        ) : (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[#001433]">
            Behandlingsansvarlig (juridisk navn, org.nr. og adresse) publiseres her når opplysningene er
            registrert. Kontakt oss om personvern på{' '}
            <a className="font-medium underline" href={`mailto:${DATA_CONTROLLER.privacyEmail}`}>
              {DATA_CONTROLLER.privacyEmail}
            </a>
            .
          </p>
        )}
        <p>
          Kontakt om personvern:{' '}
          <a className="font-medium text-[#00205b] underline" href={`mailto:${DATA_CONTROLLER.privacyEmail}`}>
            {DATA_CONTROLLER.privacyEmail}
          </a>
          {controllerBlock ? ` eller per post til ${DATA_CONTROLLER.postalAddress.trim()}.` : '.'}
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="text-xl font-bold text-[#001433]">2. Hva behandler vi, hvorfor og hvor lenge?</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#00205b]/15">
                <th className="py-2 pr-3 font-semibold">Formål</th>
                <th className="py-2 pr-3 font-semibold">Opplysninger</th>
                <th className="py-2 pr-3 font-semibold">Grunnlag</th>
                <th className="py-2 font-semibold">Lagring</th>
              </tr>
            </thead>
            <tbody>
              {PRIVACY_PROCESSING_TABLE.map((row) => (
                <tr key={row.purpose} className="border-b border-[#00205b]/10 align-top">
                  <td className="py-3 pr-3">{row.purpose}</td>
                  <td className="py-3 pr-3 text-[#001433]/80">{row.data}</td>
                  <td className="py-3 pr-3 text-[#001433]/80">{row.legalBasis}</td>
                  <td className="py-3 text-[#001433]/80">{row.retention}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[#001433]/75">
          Navn og e-post er påkrevd ved registrering for å opprette konto. Uten dette kan du ikke bruke
          innloggede funksjoner.
        </p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-xl font-bold text-[#001433]">3. Mottakere og underleverandører</h2>
        <p>{PRIVACY_RECIPIENTS_INTRO}</p>
        <p className="font-medium text-[#001433]">{TRUST_HOSTING_SUMMARY}</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-[#001433]">4. Egen drift (Norge)</h2>
        <SubprocessorList rows={TRUST_COOLIFY_STACK} />
      </section>

      <section>
        <h2 className="text-xl font-bold text-[#001433]">5. Andre leverandører</h2>
        <SubprocessorList rows={TRUST_THIRD_PARTY_PROVIDERS} />
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-xl font-bold text-[#001433]">6. Overføring utenfor EU/EØS</h2>
        <p>{PRIVACY_TRANSFERS}</p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-xl font-bold text-[#001433]">7. Dine rettigheter</h2>
        <p>{PRIVACY_RIGHTS}</p>
        <p>
          Samtykke til politiske holdninger administreres under{' '}
          <Link
            href={`${routes.minSide}?tab=min-data`}
            className="font-medium text-[#00205b] underline"
          >
            Min side → Personvern
          </Link>
          .
        </p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-xl font-bold text-[#001433]">8. Klage til Datatilsynet</h2>
        <p>{PRIVACY_COMPLAINT}</p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-xl font-bold text-[#001433]">9. Informasjonskapsler og lokal lagring</h2>
        <p>{PRIVACY_COOKIES}</p>
        <p className="text-[#001433]/75">{TRUST_ANALYTICS_NOTE}</p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-xl font-bold text-[#001433]">10. Aldersgrense</h2>
        <p>{PRIVACY_AGE}</p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-xl font-bold text-[#001433]">11. AI og modeller</h2>
        <p>
          Se{' '}
          <Link href={routes.omAi} className="font-medium text-[#00205b] underline">
            AI og modeller
          </Link>{' '}
          for plattformens AI-sammendrag og systempoll-utkast (Ollama via n8n).
        </p>
        <p className="text-xs text-[#001433]/60">{TRUST_VERCEL_NOTE}</p>
      </section>

    </TrustDocLayout>
  );
}
