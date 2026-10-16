import Link from 'next/link';
import { TrustDocLayout } from '@/components/trust/trust-doc-layout';
import { AI_SUMMARY_LABEL, PLATFORM_AI_PIPELINES } from '@/lib/trust/ai-transparency';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { routes } from '@/lib/routes';

export const metadata = buildPageMetadata({
  title: 'AI og modeller',
  description: 'Hvilke modeller Folkets Meninger bruker, hvor de kjører, og hva som er regelbasert.',
  canonicalPath: routes.omAi,
});

export default function OmAiPage() {
  return (
    <TrustDocLayout
      title="AI og modeller"
      description="Transparens om automatiserte sammendrag, embeddings og valgfri Stemme+-chat."
    >
      <section className="rounded-2xl border border-[#ba0c2f]/20 bg-[#ba0c2f]/[0.04] p-5 text-sm">
        <p className="font-semibold text-[#001433]">{AI_SUMMARY_LABEL}</p>
        <p className="mt-2 leading-relaxed">
          Saksammendrag på sakssider er generert av en lokal modell via n8n. De er ikke offisielle
          Stortinget-tekster. I appen merkes de «{AI_SUMMARY_LABEL}» med lenker til originaldokumenter på
          stortinget.no der vi har dem.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-[#001433]">Plattformens pipelines</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#00205b]/15 text-xs uppercase tracking-wide text-[#001433]/60">
                <th className="py-2 pr-3 font-semibold">Funksjon</th>
                <th className="py-2 pr-3 font-semibold">Modell</th>
                <th className="py-2 pr-3 font-semibold">Hvor</th>
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
          Sammendrag og RAG bygger på saksdokumenter fra{' '}
          <a
            href="https://data.stortinget.no"
            className="font-medium text-[#00205b] underline-offset-2 hover:underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            data.stortinget.no
          </a>
          . Vi henter ikke innhold fra lukkede kilder uten at det ligger i Stortingets åpne data eller
          dokumentlenker.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-[#001433]">Personvern</h2>
        <p className="mt-2 text-sm">
          <Link href={routes.personvern} className="font-medium text-[#00205b] underline-offset-2 hover:underline">
            Personvern og infrastruktur
          </Link>{' '}
          beskriver Supabase, hosting og underleverandører.
        </p>
      </section>
    </TrustDocLayout>
  );
}
