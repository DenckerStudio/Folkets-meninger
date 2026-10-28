import { getCitizenOpinion } from '@/lib/opinions/service';
import { stanceLabel } from '@/lib/opinions/labels';
import type { OpinionStance } from '@/lib/opinions/types';
import { formatNumber } from '@/lib/utils';
import {
  renderShareOgFallback,
  renderShareOgImage,
  SHARE_OG_CONTENT_TYPE,
  SHARE_OG_SIZE,
} from '@/lib/seo/share-og';

export const alt = 'Mening på Folkets Meninger';
export const size = SHARE_OG_SIZE;
export const contentType = SHARE_OG_CONTENT_TYPE;

/** Flag colours that stay readable on the navy card background. */
const STANCE_OG_COLORS: Record<OpinionStance, { background: string; color: string }> = {
  for: { background: '#3b74f0', color: '#ffffff' },
  blank: { background: '#ffffff', color: '#00205b' },
  imot: { background: '#ba0c2f', color: '#ffffff' },
};

type ImageProps = {
  params: Promise<{ id: string }>;
};

export default async function Image({ params }: ImageProps) {
  const { id } = await params;
  // getCitizenOpinion returns null both for unknown ids and read errors, so both
  // get the short-lived branded fallback rather than a long-cached 404.
  const opinion = await getCitizenOpinion(id, null).catch(() => null);
  if (!opinion) return renderShareOgFallback('Folkets meninger');

  const counts = opinion.counts;
  const stances: OpinionStance[] = ['for', 'blank', 'imot'];

  return renderShareOgImage({
    eyebrow: 'Folkets meninger',
    title: opinion.title || 'Mening',
    description: opinion.issueTitle ? `Om saken: ${opinion.issueTitle}` : null,
    pills: [{ label: stanceLabel(opinion.stance), colors: STANCE_OG_COLORS[opinion.stance] }],
    stats:
      counts.total > 0
        ? stances.map((stance) => ({
            label: stanceLabel(stance),
            value: formatNumber(counts[stance]),
            color: STANCE_OG_COLORS[stance].background,
          }))
        : [],
    footer: 'folkets-meninger.no · For, Blank eller Imot?',
  });
}
