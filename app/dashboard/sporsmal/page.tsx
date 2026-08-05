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
    <div className="space-y-8 pb-12">
      <FadeIn delay={0.1}>
        <div className="bg-card rounded-[2.5rem] shadow-sm border border-border p-8 md:p-12">
          <PageHeader
            title="Spørsmål"
            description={`Skriftlige spørsmål, spørretime og interpellasjoner fra Stortinget (${sesjonId}). Søk, filtrer og les detaljer.`}
          />
        </div>
      </FadeIn>

      <FadeIn delay={0.2} direction="up">
        <SporsmalList sporsmal={sporsmal} type={type} sesjonId={sesjonId} />
      </FadeIn>
    </div>
  );
}
