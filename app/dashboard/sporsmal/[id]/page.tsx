import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Calendar, User } from 'lucide-react';
import { BackButton } from '@/components/dashboard/back-button';
import { DashboardPage } from '@/components/dashboard/dashboard-page';
import { STORTINGET_ACTIVE_SESSION_ID } from '@/lib/stortinget-config';
import {
  findSporsmalById,
  formatSporsmalDate,
  formatSporsmalStatus,
  getSporsmalEmner,
  getSporsmalFraNavn,
  getSporsmalTitle,
  isSporsmalBesvart,
  sporsmalTypeLabel,
} from '@/lib/stortinget-sporsmal';
import { buildHenvisningToSakIdIndex, resolveSporsmalSakId } from '@/lib/sporsmal/sak-link';
import { getSporsmalSearchText } from '@/lib/sporsmal/search-text';
import { resolveSporsmalTheme } from '@/lib/sporsmal/themes';
import { getSakerWithCache } from '@/lib/stortinget-saker-cache';
import { routes } from '@/lib/routes';
import { buildPageMetadata, truncateDescription } from '@/lib/seo/metadata';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await findSporsmalById(id, STORTINGET_ACTIVE_SESSION_ID);
  if (!result) {
    return buildPageMetadata({
      title: 'Spørsmål ikke funnet',
      description: 'Dette spørsmålet finnes ikke i Stortingets åpne data for valgt sesjon.',
      canonicalPath: `/dashboard/sporsmal/${id}`,
    });
  }
  const title = getSporsmalTitle(result.item);
  return buildPageMetadata({
    title: truncateDescription(title, 70),
    description: truncateDescription(getSporsmalSearchText(result.item)),
    canonicalPath: `/dashboard/sporsmal/${id}`,
    openGraphType: 'article',
    keywords: ['Stortinget', sporsmalTypeLabel(result.type), resolveSporsmalTheme(result.item)],
  });
}

export default async function SporsmalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await findSporsmalById(id, STORTINGET_ACTIVE_SESSION_ID);

  if (!result) {
    notFound();
  }

  const { item: question, type } = result;
  const title = getSporsmalTitle(question);
  const fraNavn = getSporsmalFraNavn(question);
  const emner = getSporsmalEmner(question);
  const theme = resolveSporsmalTheme(question);
  const besvart = isSporsmalBesvart(question);
  const sendt = formatSporsmalDate(question.sendt_dato) ?? formatSporsmalDate(question.datert_dato);
  const besvartDato = formatSporsmalDate(question.besvart_dato);
  const statusLabel = formatSporsmalStatus(question.status);
  const fullText = getSporsmalSearchText(question);

  const saker = await getSakerWithCache({ includeAll: false, preferDb: true });
  const henvisningIndex = buildHenvisningToSakIdIndex(
    saker.map((sak) => ({ id: sak.id, henvisning: sak.henvisning ?? null })),
  );
  const sakId = resolveSporsmalSakId(fullText, henvisningIndex);

  return (
    <DashboardPage>
      <BackButton fallbackHref={routes.sporsmal} />

      <article className="bg-card rounded-3xl border border-border p-8 shadow-sm space-y-6">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand/10 text-brand">
            {sporsmalTypeLabel(type)}
          </span>
          <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground">
            {theme}
          </span>
          <span
            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              besvart ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800' : 'bg-amber-100 dark:bg-amber-950/50 text-amber-800'
            }`}
          >
            {besvart ? 'Besvart' : 'Ubesvart'}
          </span>
          {statusLabel && (
            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground">
              {statusLabel}
            </span>
          )}
        </div>

        <h1 className="text-2xl font-bold text-foreground">{title}</h1>

        {fullText.length > 200 && (
          <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">{fullText}</div>
        )}

        <dl className="grid sm:grid-cols-2 gap-4 text-sm">
          {fraNavn && (
            <div className="flex gap-2">
              <User className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <dt className="text-muted-foreground">Fra</dt>
                <dd className="font-medium text-foreground">
                  {question.sporsmal_fra?.id ? (
                    <Link href={routes.politiker(question.sporsmal_fra.id)} className="hover:text-brand">
                      {fraNavn}
                      {question.sporsmal_fra.parti?.navn ? ` (${question.sporsmal_fra.parti.navn})` : ''}
                    </Link>
                  ) : (
                    fraNavn
                  )}
                </dd>
              </div>
            </div>
          )}
          {question.sporsmal_til_minister_tittel && (
            <div className="flex gap-2">
              <User className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <dt className="text-muted-foreground">Til</dt>
                <dd className="font-medium text-foreground">{question.sporsmal_til_minister_tittel}</dd>
              </div>
            </div>
          )}
          {sendt && (
            <div className="flex gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <dt className="text-muted-foreground">Dato</dt>
                <dd className="font-medium text-foreground">{sendt}</dd>
              </div>
            </div>
          )}
          {besvartDato && (
            <div className="flex gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <dt className="text-muted-foreground">Besvart</dt>
                <dd className="font-medium text-foreground">
                  {besvartDato}
                  {question.besvart_av_minister_tittel ? ` av ${question.besvart_av_minister_tittel}` : ''}
                </dd>
              </div>
            </div>
          )}
        </dl>

        {sakId ? (
          <div>
            <Link
              href={routes.sak(sakId)}
              className="inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline"
            >
              Se relatert stortingssak →
            </Link>
          </div>
        ) : null}

        {emner.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Emner</p>
            <div className="flex flex-wrap gap-2">
              {emner.map((emne) => (
                <span key={emne} className="inline-flex px-2.5 py-1 rounded-lg bg-muted text-sm text-foreground">
                  {emne}
                </span>
              ))}
            </div>
          </div>
        )}
      </article>
    </DashboardPage>
  );
}