import { getSak, type StortingetSakDetail } from '@/lib/stortinget';
import { getCachedSakDetail } from '@/lib/stortinget-detail-cache';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink, MessageSquare, Users, FileText, GitBranch, Tag, Building2 } from 'lucide-react';
import AiSummary from './ai-summary';
import PoliticianResponseForm from './politician-response-form';
import ShareButton from './share-button';
import FadeIn from '@/components/fade-in';
import ExpandableText from './expandable-text';
import VotingSection from './voting-section';
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

function cleanSaksgangName(name: string): string {
  return name.replace(/^K(?=[A-ZÆØÅ][a-zæøå])/, '');
}

const sakTypeMap: Record<number, string> = {
  0: 'Alminnelig sak',
  1: 'Lovsak',
  2: 'Stortingssak',
  3: 'Budsjett',
  4: 'Interpellasjon',
  5: 'Spørsmål',
};

export default async function SakPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const sak = await getSak(resolvedParams.id);

  if (!sak) {
    notFound();
  }

  const detailedContent: StortingetSakDetail | null = await getCachedSakDetail(sak.id);

  const innstillingstekst = detailedContent?.innstillingstekst;
  const kortvedtak = detailedContent?.kortvedtak;
  const vedtakstekst = detailedContent?.vedtakstekst;
  const parentestekst = detailedContent?.parentestekst;

  const sakType = detailedContent?.type != null ? sakTypeMap[detailedContent.type] || `Type ${detailedContent.type}` : null;
  const sakNummer = detailedContent?.sak_nummer;
  const sakSesjon = detailedContent?.sak_sesjon;
  const henvisning = detailedContent?.henvisning;
  const ferdigbehandlet = detailedContent?.ferdigbehandlet;
  const komite = detailedContent?.komite;

  const saksgang = detailedContent?.saksgang;
  const saksgangSteg = saksgang?.saksgang_steg_liste || [];

  const forslagstillere = detailedContent?.sak_opphav?.forslagstiller_liste || [];
  const saksordfoerere = detailedContent?.saksordfoerer_liste || [];
  const emner = detailedContent?.emne_liste || [];
  const stikkord = detailedContent?.stikkord_liste || [];
  const relaterteSaker = detailedContent?.sak_relasjon_liste || [];

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-12">
      <FadeIn delay={0.1}>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link
            href={`${routes.forum}?sak=${sak.id}`}
            className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            Diskuter i forum
          </Link>
          <ShareButton id={sak.id} title={sak.title} />
        </div>
      </FadeIn>

      <FadeIn delay={0.2} direction="up">
        <div className="space-y-6">
          {/* Category + Status Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
              {sak.category}
            </span>
            {sakType && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                {sakType}
              </span>
            )}
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              ferdigbehandlet ? 'bg-gray-100 text-gray-700' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {ferdigbehandlet ? 'Ferdigbehandlet' : 'Under behandling'}
            </span>
            <span className="ml-auto text-sm text-gray-500">Sist oppdatert: {sak.date}</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">{sak.title}</h1>
          
          {/* Meta info grid */}
          {detailedContent && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sakNummer && sakSesjon && (
                <div className="flex items-start gap-3 bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <FileText className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Saksnummer</div>
                    <div className="text-sm font-semibold text-gray-900">Sak nr. {sakNummer} ({sakSesjon})</div>
                  </div>
                </div>
              )}
              {henvisning && (
                <div className="flex items-start gap-3 bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <ExternalLink className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Dokumentreferanse</div>
                    <div className="text-sm font-semibold text-gray-900">{henvisning}</div>
                  </div>
                </div>
              )}
              {komite && (
                <div className="flex items-start gap-3 bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <Building2 className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Komité</div>
                    <div className="text-sm font-semibold text-gray-900">{typeof komite === 'object' ? komite.navn : komite}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Forslagstillere (Proposers) */}
          {forslagstillere.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <Users className="w-5 h-5 mr-2 text-indigo-600" />
                Forslagstillere
              </h2>
              <div className="flex flex-wrap gap-3">
                {forslagstillere.map((f: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                    <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                      {f.id ? (
                        <Image
                          src={getPersonbildeUrl(String(f.id), 'lite', true)}
                          alt={`${f.fornavn || ''} ${f.etternavn || ''}`.trim() || 'Forslagstiller'}
                          fill
                          className="object-cover"
                          sizes="32px"
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                          {f.fornavn?.[0]}{f.etternavn?.[0]}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{f.fornavn} {f.etternavn}</div>
                      {f.parti?.navn && (
                        <div className="text-xs text-gray-500">{f.parti.navn}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Saksordførere (Case rapporteurs) */}
          {saksordfoerere.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <Users className="w-5 h-5 mr-2 text-amber-600" />
                Saksordførere
              </h2>
              <div className="flex flex-wrap gap-3">
                {saksordfoerere.map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                    <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                      {s.id ? (
                        <Image
                          src={getPersonbildeUrl(String(s.id), 'lite', true)}
                          alt={`${s.fornavn || ''} ${s.etternavn || ''}`.trim() || 'Saksordfører'}
                          fill
                          className="object-cover"
                          sizes="32px"
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-xs">
                          {s.fornavn?.[0]}{s.etternavn?.[0]}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{s.fornavn} {s.etternavn}</div>
                      {s.parti?.navn && (
                        <div className="text-xs text-gray-500">{s.parti.navn}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Saksgang (Case Progress) */}
          {saksgangSteg.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center">
                <GitBranch className="w-5 h-5 mr-2 text-indigo-600" />
                Saksgang
              </h2>
              {saksgang?.navn && (
                <p className="text-sm text-gray-500 mb-4">{cleanSaksgangName(saksgang.navn)}</p>
              )}
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
                <div className="space-y-4">
                  {saksgangSteg.map((steg: any, i: number) => {
                    const isLast = i === saksgangSteg.length - 1;
                    const allEvents = steg.saksgang_hendelse_liste || [];
                    const meaningfulEvents = allEvents
                      .filter((h: any) => {
                        const hasValidDate = h.dato && !h.dato.startsWith('01.01.0001');
                        return hasValidDate || h.hendelse_tekst;
                      })
                      .map((h: any) => ({
                        label: h.hendelse_tekst || eventLabels[h.id] || null,
                        date: formatEventDate(h.dato),
                      }))
                      .filter((e: any) => e.label || e.date);
                    const hasAnyEvents = allEvents.length > 0;
                    const stepDone = meaningfulEvents.length > 0;

                    return (
                      <div key={i} className="relative pl-10">
                        <div className={`absolute left-2.5 w-3 h-3 rounded-full border-2 ${
                          stepDone && ferdigbehandlet
                            ? 'bg-emerald-500 border-emerald-500'
                            : isLast && !ferdigbehandlet
                              ? 'bg-indigo-500 border-indigo-500'
                              : stepDone
                                ? 'bg-indigo-500 border-indigo-500'
                                : 'bg-white border-gray-300'
                        }`} style={{ top: '0.35rem' }} />
                        <div className={`text-sm font-semibold ${
                          !hasAnyEvents && !stepDone ? 'text-gray-400' : 'text-gray-800'
                        }`}>
                          {steg.navn}
                        </div>
                        {meaningfulEvents.length > 0 && (
                          <div className="mt-1.5 space-y-1">
                            {meaningfulEvents.map((evt: any, j: number) => (
                              <div key={j} className="flex items-baseline gap-2 text-xs">
                                {evt.label && (
                                  <span className="text-gray-600">{evt.label}</span>
                                )}
                                {evt.date && (
                                  <span className="text-gray-400">{evt.date}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Full description and detailed texts */}
          <div className="prose prose-indigo max-w-none text-gray-700">
            {detailedContent?.tittel && detailedContent.tittel !== sak.title && (
              <p className="text-lg leading-relaxed">{detailedContent.tittel}</p>
            )}

            {parentestekst && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 not-prose">
                <p className="text-sm text-amber-800">{parentestekst}</p>
              </div>
            )}
            
            {(innstillingstekst || kortvedtak || vedtakstekst) && (
              <div className="mt-8 space-y-6 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mt-0">Sakens detaljerte innhold</h2>
                
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
                <span key={`e-${i}`} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                  <Tag className="w-3 h-3" />
                  {e.navn || e}
                </span>
              ))}
              {stikkord.map((s: any, i: number) => (
                <span key={`s-${i}`} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">
                  {typeof s === 'object' ? s.navn : s}
                </span>
              ))}
            </div>
          )}

          {/* Related Cases */}
          {relaterteSaker.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Relaterte saker</h2>
              <div className="space-y-2">
                {relaterteSaker.map((rel: any, i: number) => {
                  const relSak = rel.relatert_sak;
                  if (!relSak) return null;
                  return (
                    <Link
                      key={i}
                      href={`/dashboard/sak/${relSak.id}`}
                      className="block p-3 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-100 transition-colors"
                    >
                      <div className="text-sm font-medium text-indigo-600">{relSak.korttittel || relSak.tittel}</div>
                      {rel.relasjonstype && (
                        <div className="text-xs text-gray-500 mt-1">{rel.relasjonstype}</div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-gray-100 flex flex-wrap gap-4">
            <a
              href={`https://data.stortinget.no/eksport/sak?sakid=${sak.id}&format=json`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors"
            >
              <ExternalLink className="mr-1.5 w-4 h-4" />
              Kilde: data.stortinget.no (Sak ID: {sak.id})
            </a>
            {henvisning && (
              <a
                href={`https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/Sak/?p=${sak.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors"
              >
                <ExternalLink className="mr-1.5 w-4 h-4" />
                Se på stortinget.no
              </a>
            )}
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.3} direction="up">
        <AiSummary sakId={sak.id} title={sak.title} summary={detailedContent?.tittel || sak.summary} />
      </FadeIn>

      <FadeIn delay={0.4} direction="up">
        <PoliticianResponseForm sakId={sak.id} />
      </FadeIn>

      <FadeIn delay={0.5} direction="up">
        <VotingSection initialVotes={sak.votes} sakId={sak.id} sakTitle={sak.title} sakSummary={sak.summary} />
      </FadeIn>
    </div>
  );
}
