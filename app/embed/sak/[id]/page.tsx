import { notFound } from 'next/navigation';
import { getAiSummaryFromDb } from '@/lib/ai-summary/service';
import { isAiSummaryV2, type AiSummary } from '@/lib/ai-summary/types';
import {
  getSakTreatmentBadgeClassName,
  getSakTreatmentLabel,
  resolveSakListStatus,
} from '@/lib/sak-status';
import { getCachedSakDetail } from '@/lib/stortinget-detail-cache';
import { mapSakPresentation } from '@/lib/stortinget-sak-presentation';

export const dynamic = 'force-dynamic';

type SakEmbedPageProps = {
  params: Promise<{ id: string }>;
};

function komiteName(komite: unknown): string | null {
  if (typeof komite === 'string' && komite.trim()) return komite.trim();
  if (komite && typeof komite === 'object' && 'navn' in komite) {
    const navn = (komite as { navn?: unknown }).navn;
    if (typeof navn === 'string' && navn.trim()) return navn.trim();
  }
  return null;
}

function aiBlurb(summary: AiSummary | null): string | null {
  if (!summary) return null;
  if (isAiSummaryV2(summary)) return summary.narrative;
  switch (summary.version) {
    case 1:
      return summary.hva;
    default: {
      const _exhaustive: never = summary;
      return _exhaustive;
    }
  }
}

export default async function SakEmbedPage({ params }: SakEmbedPageProps) {
  const { id } = await params;
  const sakId = id.trim();
  if (!sakId) notFound();

  const [detail, ai] = await Promise.all([
    getCachedSakDetail(sakId),
    getAiSummaryFromDb(sakId).catch(() => null),
  ]);

  if (!detail) notFound();

  const presentation = mapSakPresentation({
    korttittel: detail.korttittel,
    tittel: detail.tittel,
    henvisning: detail.henvisning,
    dokumentgruppe: typeof detail.dokumentgruppe === 'number' ? detail.dokumentgruppe : null,
    emneNavn: detail.emne_liste?.[0]?.navn,
  });
  const title = presentation.title || detail.korttittel || detail.tittel || `Sak ${detail.id}`;
  const summary = presentation.summary;
  const komite = komiteName(detail.komite);
  const status = resolveSakListStatus({
    ferdigbehandlet: detail.ferdigbehandlet,
    numericStatus: typeof detail.status === 'number' ? detail.status : null,
  });
  const aiText = aiBlurb(ai);

  return (
    <article className="space-y-4 text-foreground">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${getSakTreatmentBadgeClassName(status)}`}>
            {getSakTreatmentLabel(status)}
          </span>
          {presentation.category ? (
            <span className="text-xs text-muted-foreground">{presentation.category}</span>
          ) : null}
        </div>
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">
          {presentation.henvisning ? `${presentation.henvisning} · ` : ''}
          Sak {detail.id}
          {komite ? ` · ${komite}` : ''}
        </p>
      </header>

      {summary ? (
        <p className="text-sm leading-relaxed text-foreground/90">{summary}</p>
      ) : null}

      {aiText ? (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Kort om saken</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{aiText}</p>
        </section>
      ) : null}

      {detail.parentestekst ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{detail.parentestekst}</p>
      ) : null}
    </article>
  );
}
