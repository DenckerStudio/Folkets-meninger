import { getPublicPollById, getPollTotals } from '@/lib/polls/service';
import { isShareablePoll } from '@/lib/polls/share';
import {
  OG_IMAGE_ALT,
  OG_IMAGE_CONTENT_TYPE,
  OG_IMAGE_SIZE,
  pollOgImageAlt,
  renderPollShareOgFallback,
  renderPollShareOgImage,
} from '@/lib/polls/share-og';

/** Keep in sync with SHARE_OG_REVALIDATE_SECONDS (Next.js requires a literal here). */
export const revalidate = 300;
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

type ImageProps = {
  params: Promise<{ id: string }>;
};

const EMPTY_TOTALS = { ja: 0, nei: 0, blank: 0, total: 0 };

export async function generateImageMetadata({ params }: ImageProps) {
  const { id } = await params;
  const poll = await getPublicPollById(id).catch(() => null);
  if (!poll || !isShareablePoll(poll)) {
    return [{ alt: OG_IMAGE_ALT, ...OG_IMAGE_SIZE, contentType: OG_IMAGE_CONTENT_TYPE }];
  }
  const totals = await getPollTotals(id).catch(() => EMPTY_TOTALS);
  return [
    {
      alt: pollOgImageAlt(poll.title, totals),
      ...OG_IMAGE_SIZE,
      contentType: OG_IMAGE_CONTENT_TYPE,
    },
  ];
}

export default async function Image({ params }: ImageProps) {
  const { id } = await params;
  const poll = await getPublicPollById(id).catch(() => null);
  if (!poll || !isShareablePoll(poll)) return renderPollShareOgFallback();
  const totals = await getPollTotals(id).catch(() => EMPTY_TOTALS);
  return renderPollShareOgImage(poll, totals);
}
