import { DashboardPage } from '@/components/dashboard/dashboard-page';
import FadeIn from '@/components/fade-in';
import { PageHeader } from '@/components/page-header';
import SporsmalList from '@/components/sporsmal/sporsmal-list';
import { STORTINGET_ACTIVE_SESSION_ID } from '@/lib/stortinget-config';
import { getSporsmalListe, type SporsmalType } from '@/lib/stortinget';

export const revalidate = 3600;

export default async function SporsmalPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; sesjonId?: string }>;
}) {
  const sp = await searchParams;
  const type: SporsmalType =
    sp.type === 'interpellasjoner' || sp.type === 'skriftligesporsmal' || sp.type === 'sporretimesporsmal'
      ? sp.type
      : 'skriftligesporsmal';
  const sesjonId = sp.sesjonId || STORTINGET_ACTIVE_SESSION_ID;

  const sporsmal = await getSporsmalListe({
    type,
    sesjonId,
    nextRevalidateSeconds: 3600,
  });

  return (
    <DashboardPage>
      <FadeIn delay={0.1}>
        <PageHeader
          title="Spørsmål"
          description={`Skriftlige spørsmål, spørretime og interpellasjoner fra Stortinget (${sesjonId}). Søk, filtrer og les detaljer.`}
        />
      </FadeIn>

      <FadeIn delay={0.2} direction="up">
        <SporsmalList sporsmal={sporsmal} type={type} sesjonId={sesjonId} />
      </FadeIn>
    </DashboardPage>
  );
}
