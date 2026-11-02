import { notFound } from 'next/navigation';
import { getPublicPollById, getPollTotals } from '@/lib/polls/service';
import { isPublicSharePollRouteEnabledForRequest } from '@/lib/polls/del-share-route';
import { isShareablePoll } from '@/lib/polls/share';
import {
  OG_IMAGE_ALT,
  OG_IMAGE_CONTENT_TYPE,
  OG_IMAGE_SIZE,
  renderPollShareOgFallback,
  renderPollShareOgImage,
} from '@/lib/polls/share-og';

/** Keep in sync with SHARE_OG_REVALIDATE_SECONDS (Next.js requires a literal here). */
export const revalidate = 300;
export const alt = OG_IMAGE_ALT;
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

type ImageProps = {
  params: Promise<{ id: string }>;
};

const EMPTY_TOTALS = { ja: 0, nei: 0, blank: 0, total: 0 };

export default async function Image({ params }: ImageProps) {
  if (!(await isPublicSharePollRouteEnabledForRequest())) {
    notFound();
  }

  const { id } = await params;
  const poll = await getPublicPollById(id).catch(() => null);
  if (!poll || !isShareablePoll(poll)) return renderPollShareOgFallback();
  const totals = await getPollTotals(id).catch(() => EMPTY_TOTALS);
  return renderPollShareOgImage(poll, totals);
}
