import Link from 'next/link';
import { TrustDocLayout } from '@/components/trust/trust-doc-layout';
import { AI_SUMMARY_LABEL, PLATFORM_AI_PIPELINES } from '@/lib/trust/ai-transparency';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { routes } from '@/lib/routes';

export const metadata = buildPageMetadata({
  title: 'AI og modeller',
  description: 'Hvilke AI-modeller Folkets Meninger bruker, og hvor de kjører.',
  canonicalPath: routes.omAi,
});

export default function OmAiPage() {
  return (
    <TrustDocLayout
      title="AI og modeller"
      description="Hva vi bruker AI til, hvilke modeller det er, og hva som ikke bruker AI."
    >
      <section className="rounded-2xl border border-[#ba0c2f]/20 bg-[#ba0c2f]/[0.04] p-5 text-sm">
        <p className="font-semibold text-[#001433]">{AI_SUMMARY_LABEL}</p>
        <p className="mt-2 leading-relaxed">
          Sammendragene på sakssidene er laget av en AI-modell på vår egen server. De er ikke offisielle
          tekster fra Stortinget. De er merket «{AI_SUMMARY_LABEL}» og lenker til originaldokumentene når
          vi har dem.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-[#001433]">Hvor vi bruker AI</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#00205b]/15 text-xs uppercase tracking-wide text-[#001433]/60">
                <th className="py-2 pr-3 font-semibold">Funksjon</th>
                <th className="py-2 pr-3 font-semibold">Modell</th>
                <th className="py-2 pr-3 font-semibold">Hvor den kjører</th>
              </tr>
            </thead>
            <tbody>
              {PLATFORM_AI_PIPELINES.map((row) => (
                <tr key={row.feature} className="border-b border-[#00205b]/8 align-top">
                  <td className="py-3 pr-3 font-medium text-[#001433]">{row.feature}</td>
                  <td className="py-3 pr-3">{row.model}</td>
                  <td className="py-3 pr-3">{row.where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-[#001433]/55">
          Detaljer i repo: workflows/n8n/ai-summary-backfill.workflow.ts, document-embeddings.workflow.ts,
          system-poll-draft.workflow.ts.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-[#001433]">Kilder</h2>
        <p className="mt-2 text-sm leading-relaxed">
          Sammendragene og dokumentsøket bygger på saksdokumentene fra{' '}
          <a
            href="https://data.stortinget.no"
            className="font-medium text-[#00205b] underline-offset-2 hover:underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            data.stortinget.no
          </a>
          . I Stemme+-chatten kan svarene i tillegg bruke vanlige nettsøk.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-[#001433]">Personvern</h2>
        <p className="mt-2 text-sm">
          <Link href={routes.personvern} className="font-medium text-[#00205b] underline-offset-2 hover:underline">
            Personvern og infrastruktur
          </Link>{' '}
          viser hvor data ligger, og hvilke leverandører vi bruker.
        </p>
      </section>
    </TrustDocLayout>
  );
}
