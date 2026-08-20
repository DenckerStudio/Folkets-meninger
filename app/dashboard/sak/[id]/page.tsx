import { getSakPageBundle, type StortingetSakDetail } from '@/lib/stortinget';
import { classifySakKind, getSakKindLabel } from '@/lib/stortinget-sak-presentation';
import { SAK_META_TOOLTIPS } from '@/lib/stortinget-sak-tooltips';
import { SakProcessingBadge, SakStatusBadge } from '@/components/sak/sak-meta';
import { SAK_CATEGORY_BADGE_CLASS, SAK_KIND_BADGE_CLASS, SAK_TYPE_BADGE_CLASS, resolveSakListStatus } from '@/lib/sak-status';
import { formatStortingetDate } from '@/lib/stortinget-horinger';
import { SaksgangTimeline, type SaksgangStep } from '@/components/sak/saksgang-timeline';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink, Tag } from 'lucide-react';
import { BackButton } from '@/components/dashboard/back-button';
import { routes } from '@/lib/routes';
import AiSummary from './ai-summary';
import PoliticianResponseForm from './politician-response-form';
import FadeIn from '@/components/fade-in';
import ExpandableText from './expandable-text';
import { SakDocumentsSection } from '@/components/sak/sak-documents-section';
import { SakPageActions } from '@/components/sak/sak-page-actions';
import { SakShareProvider } from '@/components/sak/sak-share-context';
import { SakPeople } from '@/components/sak/sak-people';
import { SakRelatedPoll } from '@/components/sak/sak-related-poll';
import { RedditJoinBanner } from '@/components/sak/reddit-join-banner';
import { getSakDocumentsWithStatus } from '@/lib/stortinget-document-ingest';
import { getPollByStortingetIssueId } from '@/lib/polls/service';

export const dynamic = 'force-dynamic';

function formatEventDate(dateStr: string | null): string | null {
  if (!dateStr || dateStr.startsWith('01.01.0001')) return null;
  const match = dateStr.match(/\/Date\((\d+)[+-]\d+\)\//);
  if (match && match[1]) {
    const d = new Date(parseInt(match[1], 10));
    return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  const parts = dateStr.split(' ')[0];
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(parts)) {
    const [day, month, year] = parts.split('.');
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' });
    }
  }
  return dateStr;
}

const eventLabels: Record<string, string> = {
  FRADEP: 'Fra departementet',
  FRAREP: 'Fra representant',
  SAK: 'Sak opprettet',
  FREMMET: 'Fremmet',
  REFS: 'Referert i Stortinget',
  SENDT: 'Sendt til komité',
  KOMITE: 'Til komitébehandling',
  HOERFRIST: 'Høringsfrist',
  HOER: 'Høring',
  ORDFORER: 'Saksordfører oppnevnt',
  INNST: 'Innstilling avgitt',
  BEHS: 'Behandlet i Stortinget',
  PLBEHS: 'Planlagt behandling',
  VOT: 'Votering',
  VEDTAK: 'Vedtak',
  DEBATT: 'Debatt',
  LOV: 'Lov vedtatt',
};

const sakTypeMap: Record<number, string> = {
  0: 'Alminnelig sak',
  1: 'Lovsak',
  2: 'Stortingssak',
  3: 'Budsjett',
  4: 'Interpellasjon',
  5: 'Spørsmål',
};

function buildSaksgangSteps(
  saksgangSteg: NonNullable<StortingetSakDetail['saksgang']>['saksgang_steg_liste'],
): SaksgangStep[] {
  return (saksgangSteg ?? []).map((steg) => {
    const allEvents = steg.saksgang_hendelse_liste || [];
    const events = allEvents
      .filter((h) => {
        const hasValidDate = h.dato && !h.dato.startsWith('01.01.0001');
        return hasValidDate || h.hendelse_tekst;
      })
      .map((h) => ({
        id: h.id,
        label: h.hendelse_tekst || eventLabels[h.id ?? ''] || null,
        date: formatEventDate(h.dato ?? null),
      }))
      .filter((e) => e.label || e.date);

    return {
      navn: steg.navn,
      events,
    };
  });
}

export default async function SakPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  const bundle = await getSakPageBundle(resolvedParams.id);

  if (!bundle) {
    notFound();
  }

  const { sak, detail: detailedContent, issueMeta } = bundle;
  const [documents, relatedPoll] = await Promise.all([
    getSakDocumentsWithStatus(sak.id, detailedContent),
    getPollByStortingetIssueId(sak.id),
  ]);

  const innstillingstekst = detailedContent?.innstillingstekst;
  const kortvedtak = detailedContent?.kortvedtak;
  const vedtakstekst = detailedContent?.vedtakstekst;
  const parentestekst = detailedContent?.parentestekst;

  const sakType = detailedContent?.type != null ? sakTypeMap[detailedContent.type] || `Type ${detailedContent.type}` : null;
  const sakNummer = detailedContent?.sak_nummer;
  const sakSesjon = detailedContent?.sak_sesjon;
  const henvisning = detailedContent?.henvisning;
  const komite = detailedContent?.komite;
  const komiteName = komite && typeof komite === 'object' ? komite.navn : komite;

  const saksgang = detailedContent?.saksgang;
  const saksgangSteps = buildSaksgangSteps(saksgang?.saksgang_steg_liste);

  const forslagstillere = detailedContent?.sak_opphav?.forslagstiller_liste || [];
  const saksordfoerere = detailedContent?.saksordfoerer_liste || [];
  const emner = detailedContent?.emne_liste || [];
  const stikkord = detailedContent?.stikkord_liste || [];
  const relaterteSaker = detailedContent?.sak_relasjon_liste || [];
  const displaySakKind =
    sak.sakKind ??
    classifySakKind({
      henvisning: sak.henvisning ?? henvisning,
      dokumentgruppe:
        typeof detailedContent?.dokumentgruppe === 'number' ? detailedContent.dokumentgruppe : null,
    });

  const treatmentStatus = detailedContent
    ? resolveSakListStatus({
        ferdigbehandlet: detailedContent.ferdigbehandlet,
        numericStatus: detailedContent.status,
      })
    : issueMeta?.status ?? sak.status;

  const lastUpdatedLabel =
    formatStortingetDate(sak.date) ??
    (issueMeta?.lastUpdatedAt ? formatStortingetDate(issueMeta.lastUpdatedAt) : null);

  const metaBits = [
    sakNummer && sakSesjon ? `Sak nr. ${sakNummer} (${sakSesjon})` : null,
    henvisning || sak.henvisning,
    typeof komiteName === 'string' ? komiteName : null,
    lastUpdatedLabel ? `Oppdatert ${lastUpdatedLabel}` : null,
  ].filter((bit): bit is string => Boolean(bit));

  return (
    <SakShareProvider sakId={sak.id} title={sak.title}>
      <div className="relative mx-auto max-w-3xl space-y-8 pb-16 sm:space-y-10">
        <FadeIn delay={0.05}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <BackButton fallbackHref={routes.utforsk} />
            <SakPageActions />
          </div>
        </FadeIn>

        <RedditJoinBanner status={resolvedSearch.reddit} />

        <FadeIn delay={0.1} direction="up">
          <header className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {displaySakKind ? (
                <SakStatusBadge
                  label={getSakKindLabel(displaySakKind)}
                  tooltip={
                    displaySakKind === 'lovforslag'
                      ? SAK_META_TOOLTIPS.lovforslag
                      : SAK_META_TOOLTIPS.representantforslag
                  }
                  className={SAK_KIND_BADGE_CLASS}
                />
              ) : null}
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${SAK_CATEGORY_BADGE_CLASS}`}>
                {sak.category}
              </span>
              {sakType ? (
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${SAK_TYPE_BADGE_CLASS}`}>
                  {sakType}
                </span>
              ) : null}
              <SakProcessingBadge status={treatmentStatus} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{sak.title}</h1>
            {metaBits.length > 0 ? (
              <p className="text-sm text-muted-foreground">{metaBits.join(' · ')}</p>
            ) : null}
          </header>
        </FadeIn>

        <SakRelatedPoll poll={relatedPoll} />

        <FadeIn delay={0.15} direction="up">
          <AiSummary sakId={sak.id} title={sak.title} summary={detailedContent?.tittel || sak.summary} />
        </FadeIn>

        {documents.length > 0 ? (
          <FadeIn delay={0.18} direction="up">
            <SakDocumentsSection sakId={sak.id} initialDocuments={documents} />
          </FadeIn>
        ) : null}

        {saksgangSteps.length > 0 ? (
          <FadeIn delay={0.2} direction="up">
            <SaksgangTimeline
              saksgangName={saksgang?.navn}
              steps={saksgangSteps}
              ferdigbehandlet={treatmentStatus === 'closed'}
            />
          </FadeIn>
        ) : null}

        <FadeIn delay={0.22} direction="up">
          <SakPeople forslagstillere={forslagstillere} saksordfoerere={saksordfoerere} />
        </FadeIn>

        {(parentestekst || innstillingstekst || kortvedtak || vedtakstekst) ? (
          <FadeIn delay={0.24} direction="up">
            <div className="space-y-4">
              {parentestekst ? (
                <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                  {parentestekst}
                </p>
              ) : null}
              {(innstillingstekst || kortvedtak || vedtakstekst) ? (
                <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                  <h2 className="mb-4 text-lg font-semibold text-foreground">Saksdetaljer</h2>
                  {innstillingstekst ? <ExpandableText title="Innstilling" text={innstillingstekst} /> : null}
                  {kortvedtak ? <ExpandableText title="Kortvedtak" text={kortvedtak} /> : null}
                  {vedtakstekst ? <ExpandableText title="Vedtakstekst" text={vedtakstekst} /> : null}
                </div>
              ) : null}
            </div>
          </FadeIn>
        ) : null}

        {(emner.length > 0 || stikkord.length > 0) ? (
          <div className="flex flex-wrap gap-2">
            {emner.map((e, i) => (
              <span
                key={`e-${i}`}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground"
              >
                <Tag className="h-3 w-3" />
                {typeof e === 'object' ? e.navn : e}
              </span>
            ))}
            {stikkord.map((s, i) => (
              <span
                key={`s-${i}`}
                className="inline-flex items-center rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground"
              >
                {typeof s === 'object' ? s.navn : s}
              </span>
            ))}
          </div>
        ) : null}

        {relaterteSaker.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Relaterte saker</h2>
            <div className="space-y-2">
              {relaterteSaker.map((rel, i) => {
                const relSak = rel.relatert_sak;
                if (!relSak?.id) return null;
                return (
                  <Link
                    key={i}
                    href={routes.sak(String(relSak.id))}
                    className="block rounded-xl border border-border px-4 py-3 hover:bg-muted/50"
                  >
                    <div className="text-sm font-medium text-foreground">{relSak.korttittel || relSak.tittel}</div>
                    {rel.relasjonstype ? (
                      <div className="mt-1 text-xs text-muted-foreground">{rel.relasjonstype}</div>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        <div className="flex flex-col gap-2 border-t border-border pt-6 text-sm sm:flex-row sm:flex-wrap sm:gap-4">
          <a
            href={`https://data.stortinget.no/eksport/sak?sakid=${sak.id}&format=json`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center font-medium text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="mr-1.5 h-4 w-4" />
            data.stortinget.no
          </a>
          <a
            href={`https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/Sak/?p=${sak.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center font-medium text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="mr-1.5 h-4 w-4" />
            stortinget.no
          </a>
        </div>

        <PoliticianResponseForm sakId={sak.id} />
      </div>
    </SakShareProvider>
  );
}
