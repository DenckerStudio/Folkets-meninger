import { notFound } from 'next/navigation';
import { getSakPageBundle } from '@/lib/stortinget';
import { classifySakKind, getSakKindLabel } from '@/lib/stortinget-sak-presentation';
import { getSakTreatmentLabel } from '@/lib/sak-status';
import {
  renderShareOgFallback,
  renderShareOgImage,
  SHARE_OG_CONTENT_TYPE,
  SHARE_OG_SIZE,
} from '@/lib/seo/share-og';

export const alt = 'Stortingssak på Folkets Meninger';
export const size = SHARE_OG_SIZE;
export const contentType = SHARE_OG_CONTENT_TYPE;

type ImageProps = {
  params: Promise<{ id: string }>;
};

export default async function Image({ params }: ImageProps) {
  const { id } = await params;
  let bundle: Awaited<ReturnType<typeof getSakPageBundle>>;
  try {
    bundle = await getSakPageBundle(id);
  } catch (error) {
    console.error('sak opengraph-image:', error instanceof Error ? error.message : error);
    return renderShareOgFallback('Stortingssak');
  }
  if (!bundle) notFound();

  const { sak, detail } = bundle;
  const title = (detail.korttittel || detail.tittel || sak.title || 'Stortingssak').trim();
  const kind =
    sak.sakKind ??
    classifySakKind({
      henvisning: sak.henvisning ?? detail.henvisning ?? null,
      dokumentgruppe: typeof detail.dokumentgruppe === 'number' ? detail.dokumentgruppe : null,
    });
  const komite = typeof detail.komite === 'object' ? detail.komite?.navn : detail.komite;

  return renderShareOgImage({
    eyebrow: 'Stortingssak',
    title,
    description: komite ? `Komité: ${komite}` : null,
    pills: [
      ...(kind ? [{ label: getSakKindLabel(kind), tone: 'neutral' as const }] : []),
      {
        label: getSakTreatmentLabel(sak.status),
        tone: sak.status === 'closed' ? ('neutral' as const) : ('positive' as const),
      },
    ],
    footer: 'folkets-meninger.no · Hva mener du om saken?',
  });
}
