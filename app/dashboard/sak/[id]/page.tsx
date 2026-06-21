import { getSakPageBundle, type StortingetSakDetail } from '@/lib/stortinget';
import { classifySakKind, getSakKindLabel } from '@/lib/stortinget-sak-presentation';
import { SAK_META_TOOLTIPS } from '@/lib/stortinget-sak-tooltips';
import { SakMetaCard, SakProcessingBadge, SakSectionHeading, SakStatusBadge } from '@/components/sak/sak-meta';
import { SAK_CATEGORY_BADGE_CLASS, SAK_KIND_BADGE_CLASS, SAK_TYPE_BADGE_CLASS, resolveSakListStatus } from '@/lib/sak-status';
import { getSakVotingWindow } from '@/lib/sak-voting-window';
import { formatStortingetDate } from '@/lib/stortinget-horinger';
import { SaksgangTimeline, type SaksgangStep } from '@/components/sak/saksgang-timeline';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, MessageSquare, Users, Tag } from 'lucide-react';
import AiSummary from './ai-summary';
import PoliticianResponseForm from './politician-response-form';
import ShareButton from './share-button';
import FadeIn from '@/components/fade-in';
import ExpandableText from './expandable-text';
import VotingSection from './voting-section';
import { SakDocumentsSection } from '@/components/sak/sak-documents-section';
import { getSakDocumentsWithStatus } from '@/lib/stortinget-document-ingest';
import Image from 'next/image';
import { getPersonbildeUrl } from '@/lib/stortinget-utils';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

function parseStortingetDate(dateStr: string): string {
  if (!dateStr) return '';
  const match = dateStr.match(/\/Date\((\d+)[+-]\d+\)\//);
  if (match && match[1]) {
    const date = new Date(parseInt(match[1], 10));
    return date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  return dateStr;
}

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

export default async function SakPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const bundle = await getSakPageBundle(resolvedParams.id);

  if (!bundle) {
    notFound();
  }

  const { sak, detail: detailedContent, issueMeta } = bundle;
  const documents = await getSakDocumentsWithStatus(sak.id, detailedContent);

  const innstillingstekst = detailedContent?.innstillingstekst;
  const kortvedtak = detailedContent?.kortvedtak;
  const vedtakstekst = detailedContent?.vedtakstekst;
  const parentestekst = detailedContent?.parentestekst;

  const sakType = detailedContent?.type != null ? sakTypeMap[detailedContent.type] || `Type ${detailedContent.type}` : null;
  const sakNummer = detailedContent?.sak_nummer;
  const sakSesjon = detailedContent?.sak_sesjon;
  const henvisning = detailedContent?.henvisning;
  const komite = detailedContent?.komite;

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

  const votingWindow = getSakVotingWindow(detailedContent, {
    ferdigbehandlet: detailedContent?.ferdigbehandlet ?? issueMeta?.ferdigbehandlet,
  });
  const votingClosed = treatmentStatus === 'closed' || !votingWindow.isOpen;

  const lastUpdatedLabel =
    formatStortingetDate(sak.date) ??
    (issueMeta?.lastUpdatedAt ? formatStortingetDate(issueMeta.lastUpdatedAt) : null);

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-12">
      <FadeIn delay={0.1}>
<<<<<<< HEAD
        <div className="flex items-center justify-between">
          <Link href="/dashboard/utforsk" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
            <ArrowLeft className="mr-2 w-4 h-4" />
            Tilbake til oversikt
          </Link>
          <div className="flex gap-3">
            <Link href={`/dashboard/forum?sak=${sak.id}`} className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
              <MessageSquare className="mr-1.5 w-4 h-4" />
              Diskuter i forum
            </Link>
            <ShareButton id={sak.id} title={sak.title} />
          </div>
=======
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link
            href={`${routes.forum}?sak=${sak.id}`}
            className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            Diskuter i forum
          </Link>
          <ShareButton id={sak.id} title={sak.title} />
>>>>>>> origin/cursor/forum-delete-hamburger-1979
        </div>
      </FadeIn>

      <FadeIn delay={0.2} direction="up">
        <div className="space-y-6">
          {/* Category + Status Badges */}
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
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${SAK_CATEGORY_BADGE_CLASS}`}>
              {sak.category}
            </span>
            {sakType ? (
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${SAK_TYPE_BADGE_CLASS}`}>
                {sakType}
              </span>
            ) : null}
            <SakProcessingBadge status={treatmentStatus} />
            {lastUpdatedLabel ? (
              <span className="ml-auto text-sm text-muted-foreground">Sist oppdatert: {lastUpdatedLabel}</span>
            ) : null}
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{sak.title}</h1>
          {(sak.henvisning || henvisning) ? (
            <p className="text-sm text-muted-foreground">{sak.henvisning || henvisning}</p>
          ) : null}
          
          {/* Meta info grid */}
          {detailedContent ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sakNummer && sakSesjon ? (
                <SakMetaCard icon="file-text" label="Saksnummer" tooltipKey="saksnummer">
                  Sak nr. {sakNummer} ({sakSesjon})
                </SakMetaCard>
              ) : null}
              {henvisning ? (
                <SakMetaCard icon="external-link" label="Dokumentreferanse" tooltipKey="dokumentreferanse">
                  {henvisning}
                </SakMetaCard>
              ) : null}
              {komite ? (
                <SakMetaCard icon="building-2" label="Komité" tooltipKey="komite">
                  {typeof komite === 'object' ? komite.navn : komite}
                </SakMetaCard>
              ) : null}
            </div>
          ) : null}

          {/* Forslagstillere (Proposers) */}
          {forslagstillere.length > 0 ? (
            <div className="rounded-2xl border border-border bg-card shadow-sm p-6">
              <SakSectionHeading
                title="Forslagstillere"
                tooltipKey="forslagstillere"
                icon="users"
                iconClassName="w-5 h-5 text-indigo-600 dark:text-indigo-400"
              />
              <div className="flex flex-wrap gap-3">
                {forslagstillere.map((f: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 border border-border">
                    <div className="relative w-8 h-8 rounded-full overflow-hidden bg-muted flex-shrink-0">
                      {f.id ? (
                        <Image
                          src={getPersonbildeUrl(String(f.id), 'lite', true)}
                          alt={`${f.fornavn || ''} ${f.etternavn || ''}`.trim() || 'Forslagstiller'}
                          fill
                          className="object-cover"
                          sizes="32px"
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold text-xs">
                          {f.fornavn?.[0]}{f.etternavn?.[0]}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">{f.fornavn} {f.etternavn}</div>
                      {f.parti?.navn && (
                        <div className="text-xs text-muted-foreground">{f.parti.navn}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {saksordfoerere.length > 0 ? (
            <div className="rounded-2xl border border-border bg-card shadow-sm p-6">
              <SakSectionHeading
                title="Saksordførere"
                tooltipKey="saksordfoerer"
                icon="users"
                iconClassName="w-5 h-5 text-amber-600 dark:text-amber-400"
              />
              <div className="flex flex-wrap gap-3">
                {saksordfoerere.map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 rounded-lg px-3 py-2 border border-amber-100 dark:border-amber-900/50">
                    <div className="relative w-8 h-8 rounded-full overflow-hidden bg-muted flex-shrink-0">
                      {s.id ? (
                        <Image
                          src={getPersonbildeUrl(String(s.id), 'lite', true)}
                          alt={`${s.fornavn || ''} ${s.etternavn || ''}`.trim() || 'Saksordfører'}
                          fill
                          className="object-cover"
                          sizes="32px"
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-700 dark:text-amber-300 font-bold text-xs">
                          {s.fornavn?.[0]}{s.etternavn?.[0]}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">{s.fornavn} {s.etternavn}</div>
                      {s.parti?.navn && (
                        <div className="text-xs text-muted-foreground">{s.parti.navn}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {saksgangSteps.length > 0 ? (
            <SaksgangTimeline
              saksgangName={saksgang?.navn}
              steps={saksgangSteps}
              ferdigbehandlet={treatmentStatus === 'closed'}
            />
          ) : null}
        </div>
      </FadeIn>

      <FadeIn delay={0.25} direction="up">
        <AiSummary sakId={sak.id} title={sak.title} summary={detailedContent?.tittel || sak.summary} />
      </FadeIn>

      {documents.length > 0 ? (
        <FadeIn delay={0.3} direction="up">
          <SakDocumentsSection sakId={sak.id} initialDocuments={documents} />
        </FadeIn>
      ) : null}

      <FadeIn delay={0.35} direction="up">
        <div className="space-y-6">
          {/* Full description and detailed texts */}
          <div className="prose prose-indigo dark:prose-invert max-w-none text-muted-foreground">
            {detailedContent?.tittel && detailedContent.tittel !== sak.title && (
              <p className="text-lg leading-relaxed">{detailedContent.tittel}</p>
            )}

            {parentestekst && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/50 rounded-xl p-4 not-prose">
                <p className="text-sm text-amber-800 dark:text-amber-200">{parentestekst}</p>
              </div>
            )}
            
            {(innstillingstekst || kortvedtak || vedtakstekst) && (
              <div className="mt-8 space-y-6 bg-card p-6 rounded-2xl border border-border shadow-sm">
                <h2 className="text-xl font-bold text-foreground mt-0">Sakens detaljerte innhold</h2>
                
                {innstillingstekst && (
                  <ExpandableText title="Innstilling" text={innstillingstekst} />
                )}
                
                {kortvedtak && (
                  <ExpandableText title="Kortvedtak" text={kortvedtak} />
                )}

                {vedtakstekst && (
                  <ExpandableText title="Vedtakstekst" text={vedtakstekst} />
                )}
              </div>
            )}
          </div>

          {/* Topics and Keywords */}
          {(emner.length > 0 || stikkord.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {emner.map((e: any, i: number) => (
                <span key={`e-${i}`} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-950/50 dark:text-blue-200 dark:border-blue-900/50">
                  <Tag className="w-3 h-3" />
                  {e.navn || e}
                </span>
              ))}
              {stikkord.map((s: any, i: number) => (
                <span key={`s-${i}`} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                  {typeof s === 'object' ? s.navn : s}
                </span>
              ))}
            </div>
          )}

          {/* Related Cases */}
          {relaterteSaker.length > 0 && (
            <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
              <h2 className="text-lg font-bold text-foreground mb-4">Relaterte saker</h2>
              <div className="space-y-2">
                {relaterteSaker.map((rel: any, i: number) => {
                  const relSak = rel.relatert_sak;
                  if (!relSak) return null;
                  return (
                    <Link
                      key={i}
                      href={`/dashboard/sak/${relSak.id}`}
                      className="block p-3 rounded-lg bg-muted/50 hover:bg-muted border border-border transition-colors"
                    >
                      <div className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{relSak.korttittel || relSak.tittel}</div>
                      {rel.relasjonstype && (
                        <div className="text-xs text-muted-foreground mt-1">{rel.relasjonstype}</div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-border flex flex-wrap gap-4">
            <a
              href={`https://data.stortinget.no/eksport/sak?sakid=${sak.id}&format=json`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <ExternalLink className="mr-1.5 w-4 h-4" />
              Kilde: data.stortinget.no (Sak ID: {sak.id})
            </a>
            {henvisning && (
              <a
                href={`https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/Sak/?p=${sak.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                <ExternalLink className="mr-1.5 w-4 h-4" />
                Se på stortinget.no
              </a>
            )}
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.4} direction="up">
        <PoliticianResponseForm sakId={sak.id} />
      </FadeIn>

      <FadeIn delay={0.5} direction="up">
        <VotingSection
          initialVotes={sak.votes}
          sakId={sak.id}
          sakTitle={sak.title}
          sakSummary={sak.summary}
          votingClosed={votingClosed}
          votingDaysLeft={votingWindow.daysLeft}
        />
      </FadeIn>
    </div>
  );
}
